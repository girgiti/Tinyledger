-- ============================================================
-- TINYLEDGER — Migration 003: Fix settlement delete FK
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Run AFTER 001_schema.sql and 002_splits.sql
-- ============================================================

-- Problem:
-- splits.settled_by_txn references transactions(id) with no ON DELETE
-- behavior. Deleting a settlement transaction that cleared a split
-- fails with a foreign key violation, because the split row still
-- points at it.
--
-- Fix:
-- Before a transaction row is deleted, if it was a settlement, clear
-- any splits that reference it (set settled_by_txn = null and
-- settled = false, so the balance reappears as outstanding). This
-- runs BEFORE the delete, so by the time Postgres checks the FK,
-- nothing references the row anymore and the delete succeeds.

create or replace function public.handle_settlement_delete()
returns trigger language plpgsql as $$
begin
  if OLD.type = 'settlement' then
    update public.splits
    set settled = false,
        settled_by_txn = null
    where settled_by_txn = OLD.id;
  end if;
  return OLD;
end;
$$;

drop trigger if exists trg_settlement_delete on public.transactions;

create trigger trg_settlement_delete
  before delete on public.transactions
  for each row execute function public.handle_settlement_delete();

-- ================================================================
-- DONE — Deleting a settlement transaction now automatically
-- reopens any split it had cleared, instead of failing with a
-- foreign key error.
-- ================================================================
