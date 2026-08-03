-- ============================================================
-- TINYLEDGER — Migration 002: Splits & Settlements
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Run AFTER 001_schema.sql
-- ============================================================

-- ── 1. ADD SPLIT FLAG TO TRANSACTIONS ────────────────────────
alter table public.transactions
  add column if not exists is_split      boolean not null default false,
  add column if not exists split_count   int,
  add column if not exists per_person    numeric(14,2);

-- Allow 'settlement' as a valid transaction type
alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income','expense','settlement'));

-- ── 2. SPLITS TABLE ──────────────────────────────────────────
-- One row per person who owes a share of a split transaction
create table if not exists public.splits (
  id              uuid primary key default uuid_generate_v4(),
  transaction_id  uuid not null references public.transactions(id) on delete cascade,
  debtor_id       uuid not null references public.profiles(id),   -- who owes
  creditor_id     uuid not null references public.profiles(id),   -- who paid
  amount          numeric(14,2) not null check (amount > 0),
  settled         boolean not null default false,
  settled_by_txn  uuid references public.transactions(id),        -- settlement txn that cleared this
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.splits is 'Tracks who owes what to whom for split expenses.';

-- ── 3. INDEXES ───────────────────────────────────────────────
create index if not exists splits_transaction_id_idx on public.splits(transaction_id);
create index if not exists splits_debtor_id_idx      on public.splits(debtor_id);
create index if not exists splits_creditor_id_idx    on public.splits(creditor_id);
create index if not exists splits_settled_idx        on public.splits(settled);

-- ── 4. AUTO UPDATE updated_at ON SPLITS ──────────────────────
create trigger trg_splits_updated_at
  before update on public.splits
  for each row execute function public.set_updated_at();

-- ── 5. RLS ON SPLITS ─────────────────────────────────────────
alter table public.splits enable row level security;

-- All authenticated partners can read all splits (shared ledger)
create policy "splits: all partners read"
  on public.splits for select
  using (auth.role() = 'authenticated');

-- Any partner can insert splits (created as part of a transaction)
create policy "splits: partners insert"
  on public.splits for insert
  with check (auth.role() = 'authenticated');

-- Partners can update splits they are debtor or creditor of; admins can update any
create policy "splits: own or admin update"
  on public.splits for update
  using (
    debtor_id   = auth.uid()
    or creditor_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can delete splits
create policy "splits: admin delete only"
  on public.splits for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 6. GRANTS ────────────────────────────────────────────────
grant select, insert, update, delete on public.splits to anon, authenticated;
grant all on public.splits to service_role;

-- ── 7. USEFUL VIEWS ──────────────────────────────────────────

-- Net balances: who owes whom across all unsettled splits
create or replace view public.balance_matrix as
select
  p_debtor.full_name   as debtor,
  p_creditor.full_name as creditor,
  sum(s.amount)        as total_owed
from public.splits s
join public.profiles p_debtor   on p_debtor.id   = s.debtor_id
join public.profiles p_creditor on p_creditor.id = s.creditor_id
where s.settled = false
  and s.debtor_id != s.creditor_id
group by p_debtor.full_name, p_creditor.full_name
having sum(s.amount) > 0
order by total_owed desc;

grant select on public.balance_matrix to anon, authenticated, service_role;

-- ── DONE ─────────────────────────────────────────────────────
-- After running this migration, redeploy the React app (App.jsx)
-- which now includes the Balances tab and split entry UI.
-- ============================================================
