-- ============================================================
-- TINYLEDGER — Complete Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ── 1. ENABLE UUID EXTENSION ─────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── 2. PARTNER PROFILES ──────────────────────────────────────
-- Linked 1:1 to Supabase Auth users
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  role         text not null default 'partner' check (role in ('admin','partner')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'One row per business partner, linked to Supabase Auth.';

-- ── 3. TRANSACTIONS ──────────────────────────────────────────
create table public.transactions (
  id           uuid primary key default uuid_generate_v4(),
  type         text not null check (type in ('income','expense')),
  amount       numeric(14,2) not null check (amount > 0),
  description  text not null,
  category     text not null,
  partner_id   uuid not null references public.profiles(id),
  date         date not null,
  note         text,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.transactions is 'Every financial transaction for the farm business.';

-- ── 4. AUDIT LOG ─────────────────────────────────────────────
create table public.audit_log (
  id           bigserial primary key,
  user_id      uuid references public.profiles(id),
  user_name    text,
  action       text not null,         -- ADD | EDIT | DELETE | LOGIN | LOGOUT
  table_name   text,
  record_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  ip_hint      text,
  created_at   timestamptz not null default now()
);

comment on table public.audit_log is 'Immutable audit trail. No RLS delete — append-only.';

-- ── 5. BACKUP METADATA ───────────────────────────────────────
create table public.backup_log (
  id           bigserial primary key,
  triggered_by text not null default 'scheduled',
  row_counts   jsonb,
  storage_path text,
  status       text not null default 'success',
  created_at   timestamptz not null default now()
);

-- ================================================================
-- INDEXES
-- ================================================================
create index on public.transactions (date desc);
create index on public.transactions (partner_id);
create index on public.transactions (type);
create index on public.audit_log (created_at desc);
create index on public.audit_log (user_id);

-- ================================================================
-- auto-update updated_at on transactions
-- ================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ================================================================
-- AUDIT TRIGGER FUNCTION
-- Records every INSERT / UPDATE / DELETE on transactions
-- ================================================================
create or replace function public.audit_transactions()
returns trigger language plpgsql security definer as $$
declare
  v_action   text;
  v_user_id  uuid;
  v_username text;
begin
  v_user_id  := auth.uid();
  select full_name into v_username from public.profiles where id = v_user_id;

  if (TG_OP = 'INSERT') then
    v_action := 'ADD';
    insert into public.audit_log(user_id, user_name, action, table_name, record_id, new_data)
    values (v_user_id, v_username, v_action, TG_TABLE_NAME, NEW.id, row_to_json(NEW)::jsonb);
    return NEW;

  elsif (TG_OP = 'UPDATE') then
    v_action := 'EDIT';
    insert into public.audit_log(user_id, user_name, action, table_name, record_id, old_data, new_data)
    values (v_user_id, v_username, v_action, TG_TABLE_NAME, NEW.id,
            row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    return NEW;

  elsif (TG_OP = 'DELETE') then
    v_action := 'DELETE';
    insert into public.audit_log(user_id, user_name, action, table_name, record_id, old_data)
    values (v_user_id, v_username, v_action, TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
    return OLD;
  end if;
end;
$$;

create trigger trg_audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.audit_transactions();

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- ── profiles ────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Everyone can read all profiles (needed to show partner names)
create policy "profiles: all partners can read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Only the user themselves can update their own profile
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id);

-- ── transactions ────────────────────────────────────────────
alter table public.transactions enable row level security;

-- All authenticated partners can READ all transactions
create policy "txn: all partners read"
  on public.transactions for select
  using (auth.role() = 'authenticated');

-- Any authenticated user can INSERT (created_by will be their uid)
create policy "txn: partners insert"
  on public.transactions for insert
  with check (
    auth.role() = 'authenticated'
    and created_by = auth.uid()
  );

-- Partners can only UPDATE their OWN transactions; admins can update any
create policy "txn: own or admin update"
  on public.transactions for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can DELETE transactions
create policy "txn: admin delete only"
  on public.transactions for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── audit_log ───────────────────────────────────────────────
alter table public.audit_log enable row level security;

-- Only admins can read audit log; nobody can insert/update/delete via client
create policy "audit: admin read only"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── backup_log ──────────────────────────────────────────────
alter table public.backup_log enable row level security;

create policy "backup: admin read only"
  on public.backup_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ================================================================
-- HELPER: auto-create profile row when a user signs up
-- ================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email),
    coalesce(NEW.raw_user_meta_data->>'role', 'partner')
  );
  return NEW;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ================================================================
-- DONE — Schema, RLS, Audit triggers all active.
-- ================================================================


-- ================================================================
-- GRANTS — required for anon, authenticated and service_role
-- ================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.audit_log TO anon, authenticated;
GRANT SELECT ON public.backup_log TO anon, authenticated;

GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.audit_log TO service_role;
GRANT ALL ON public.backup_log TO service_role;
GRANT USAGE ON SEQUENCE public.audit_log_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.backup_log_id_seq TO service_role;
