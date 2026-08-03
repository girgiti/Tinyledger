# 🌾 Tinyledger

> A secure, multi-partner business ledger for farm and construction operations — built on React, Supabase, and GitHub Actions. Free to host, production-ready from day one.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Components & How They Work](#components--how-they-work)
  - [React App (Frontend)](#react-app-frontend)
  - [Supabase (Backend & Database)](#supabase-backend--database)
  - [Row Level Security (RLS)](#row-level-security-rls)
  - [Audit Log (Postgres Triggers)](#audit-log-postgres-triggers)
  - [Daily Backup (Edge Function)](#daily-backup-edge-function)
  - [GitHub Actions (Backup Scheduler)](#github-actions-backup-scheduler)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Setup Guide](#setup-guide)
  - [Step 1 — Create a Supabase Project](#step-1--create-a-supabase-project)
  - [Step 2 — Run the Database Schema](#step-2--run-the-database-schema)
  - [Step 3 — Create Partner Accounts](#step-3--create-partner-accounts)
  - [Step 4 — Configure the App](#step-4--configure-the-app)
  - [Step 5 — Deploy the Backup Edge Function](#step-5--deploy-the-backup-edge-function)
  - [Step 6 — Set Up GitHub Actions](#step-6--set-up-github-actions)
  - [Step 7 — Deploy the Frontend on Cloudflare Pages](#step-7--deploy-the-frontend-on-cloudflare-pages)
- [Hosting Options](#hosting-options)
- [Cost Breakdown](#cost-breakdown)
- [Partner Roles & Permissions](#partner-roles--permissions)
- [Transaction Categories](#transaction-categories)
- [Backup & Recovery](#backup--recovery)
- [Database Operations Reference](#database-operations-reference)
  - [User Management](#user-management)
  - [Profile Management](#profile-management)
  - [Transaction Queries](#transaction-queries)
  - [Audit Log Queries](#audit-log-queries)
  - [Backup Log Queries](#backup-log-queries)
  - [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

---

## Overview

Tinyledger is a shared financial ledger built for small farm and construction businesses with multiple business partners. It replaces spreadsheets and paper records with a secure, always-accessible web app that all 5 partners can use from any device.

Every rupee that comes in or goes out is recorded, categorised, attributed to a partner, and automatically backed up every night. Every edit, deletion, and login is permanently logged in a tamper-proof audit trail.

> **Using this for a different venture?** This app is fully configurable via environment variables — no code changes needed. Each venture gets its own free Supabase project and its own free Cloudflare Pages deployment, fully isolated from every other venture using this same codebase. Copy `.env.example` to `.env.local`, fill in your own Supabase project's URL/key and (optionally) your venture's display name, then follow the [Setup Guide](#setup-guide) below start to finish. It's written generically — "5 partners" and similar numbers are just this venture's example, not a hard limit.

---

## Features

| Feature | Detail |
|---|---|
| 🔐 Secure Login | Email + password via Supabase Auth (bcrypt, brute-force protected) |
| 👥 5-Partner Access | Each partner has their own account, accessible from phone or desktop |
| 👑 Admin Role | Owner can delete records, view audit log, and manage backups |
| 📋 Full Ledger | Record income and expenses with category, date, partner, and notes |
| 📊 Live Dashboard | Real-time income, expense, and balance totals across all partners |
| 🧑‍🌾 Partner Breakdown | Per-partner income, expenses, and net balance |
| 🔍 Filters | Filter ledger by type, partner, category, or keyword search |
| 🔐 Audit Trail | Every ADD, EDIT, DELETE logged by Postgres — app cannot bypass it |
| 💾 Daily Backups | Automated nightly JSON dump to Supabase Storage via GitHub Actions |
| 🛡️ Row Level Security | Database-enforced: partners can only edit their own records |
| 📱 Mobile Friendly | Works on any browser, phone or desktop, no app install needed |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser / Phone                    │
│              React App (Vite + JSX)                  │
│   Login · Dashboard · Ledger · Partners · Audit     │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS (Supabase JS SDK)
┌────────────────────────▼────────────────────────────┐
│                    Supabase                          │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Auth        │  │  PostgreSQL  │  │  Storage   │  │
│  │  (sessions,  │  │  (data +     │  │  (backup   │  │
│  │   users)     │  │   RLS +      │  │   files)   │  │
│  └─────────────┘  │   triggers)  │  └────────────┘  │
│                   └──────┬───────┘                   │
│                          │ Edge Function              │
│                   ┌──────▼───────┐                   │
│                   │ daily-backup │                   │
│                   │  (Deno/TS)   │                   │
│                   └──────────────┘                   │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ HTTP POST (Bearer token)
┌────────────────────────┴────────────────────────────┐
│              GitHub Actions (Cron)                   │
│         Runs every night at 1:00 AM UTC              │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
tinyledger/
│
├── src/
│   └── App.jsx                        # Entire React frontend (single file)
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql             # All tables, RLS policies, triggers
│   │   ├── 002_splits.sql             # Split expenses, settlements, balance_matrix view
│   │   └── 003_fix_settlement_delete.sql  # Un-settles a split when its settlement txn is deleted
│   └── functions/
│       └── daily-backup/
│           └── index.ts               # Deno Edge Function for backups
│
├── .github/
│   └── workflows/
│       └── backup.yml                 # GitHub Actions daily cron job
│
├── public/
│   └── _redirects                     # Cloudflare Pages SPA routing fix
│
├── index.html                         # App entry point
├── package.json                       # Dependencies
├── vite.config.js                     # Build configuration
└── README.md                          # This file
```

---

## Components & How They Work

### React App (Frontend)

**File:** `src/App.jsx`

A single-file React application built with hooks. It uses the Supabase JavaScript SDK to communicate with the backend. No component library is used — all styling is inline for portability.

**Views / Screens:**

| View | Who can see | What it does |
|---|---|---|
| Login | Everyone | Email + password authentication via Supabase Auth |
| Dashboard | All partners | Live summary cards, recent transactions, partner balances |
| Ledger | All partners | Full searchable, filterable transaction table |
| New Entry | All partners | Form to add or edit a transaction |
| Partners | All partners | Per-partner income, expense, and net balance cards |
| Audit Log | Admin only | Full history of every database action with timestamps |
| Backups | Admin only | Table of every backup run, status, row counts, and storage path |

**Key state flows:**
- On load, the app checks for an existing Supabase session
- Once authenticated, it loads the user's profile (including role) and all partner profiles
- Transactions are loaded once and refreshed after every write operation
- Audit and backup logs are loaded only if the user is admin
- All writes go through the Supabase SDK and hit RLS policies before reaching the database

---

### Supabase (Backend & Database)

Supabase provides everything the app needs as a managed service:

- **Auth** — Handles user accounts, password hashing (bcrypt), session tokens (JWT), email-based password resets, and brute-force protection automatically
- **PostgreSQL** — The main database holding all business data
- **Storage** — A private S3-compatible bucket that holds daily backup files
- **Edge Functions** — Serverless Deno functions that run server-side logic (the backup runner)

The app connects using the **anon public key**, which is safe to ship in frontend code because Row Level Security prevents any unauthorised access regardless of the key.

---

### Row Level Security (RLS)

**File:** `supabase/migrations/001_schema.sql`

RLS is a Postgres feature that enforces access rules at the database level. Even if someone has the app's API key, they cannot read or write data outside their permitted scope — the database itself rejects the query.

**Rules in plain language:**

**`profiles` table:**
- Any logged-in partner can read all profiles (needed to display partner names)
- A partner can only update their own profile row

**`transactions` table:**
- Any logged-in partner can read all transactions (shared ledger)
- Any logged-in partner can insert a transaction, but only if `created_by` is their own user ID
- A partner can update a transaction only if they created it — OR if they are an admin
- Only admins can delete transactions

**`audit_log` table:**
- Only admins can read the audit log
- Nobody can insert, update, or delete audit rows via the client API — writes only happen via the server-side trigger (which runs as `security definer`)

**`backup_log` table:**
- Only admins can read backup records

---

### Audit Log (Postgres Triggers)

**File:** `supabase/migrations/001_schema.sql` — function `audit_transactions()`

The audit log is written by a **Postgres trigger**, not by the application. Even if the app code were modified or someone called the API directly, every INSERT, UPDATE, and DELETE on the `transactions` table would still generate an audit record.

**What each audit record contains:**
- Timestamp (microsecond precision)
- User ID and name of the person who made the change
- Action type: `ADD`, `EDIT`, or `DELETE`
- Table name and record ID
- `old_data` — full JSON snapshot of the row before the change
- `new_data` — full JSON snapshot of the row after the change

---

### Daily Backup (Edge Function)

**File:** `supabase/functions/daily-backup/index.ts`

A Deno TypeScript function deployed to Supabase Edge Functions. Runs with the service role key (server-only), which bypasses RLS to read all data.

**What it does on each run:**
1. Fetches all rows from `transactions`, `audit_log`, and `profiles`
2. Packages them into a timestamped JSON file
3. Uploads to the private `backups` storage bucket
4. Writes a record to `backup_log`
5. Deletes backup files older than 30 days

---

### GitHub Actions (Backup Scheduler)

**File:** `.github/workflows/backup.yml`

Fires every night at 1:00 AM UTC. Makes an authenticated HTTP POST to the Edge Function URL using secrets stored in GitHub — never in code. Can also be triggered manually from the Actions tab.

---

## Database Schema

```sql
-- Partner profiles (1:1 with Supabase Auth users)
profiles
  id           uuid  (FK → auth.users)
  full_name    text
  role         text  ('admin' | 'partner')
  created_at   timestamptz

-- All financial transactions
transactions
  id           uuid
  type         text  ('income' | 'expense')
  amount       numeric(14,2)
  description  text
  category     text
  partner_id   uuid  (FK → profiles)   -- who handled this transaction
  date         date
  note         text
  created_by   uuid  (FK → profiles)   -- who entered it into the system
  created_at   timestamptz
  updated_at   timestamptz             -- auto-updated by trigger

-- Tamper-proof audit trail (written by Postgres trigger only)
audit_log
  id           bigserial
  user_id      uuid
  user_name    text
  action       text  ('ADD' | 'EDIT' | 'DELETE')
  table_name   text
  record_id    uuid
  old_data     jsonb
  new_data     jsonb
  created_at   timestamptz

-- Backup run history
backup_log
  id           bigserial
  triggered_by text
  row_counts   jsonb
  storage_path text
  status       text  ('success' | 'failed')
  created_at   timestamptz
```

---

## Security Model

| Layer | Mechanism | What it protects |
|---|---|---|
| Transport | HTTPS (enforced by Cloudflare + Supabase) | All data in transit |
| Authentication | Supabase Auth — bcrypt passwords, JWT sessions | Prevents unauthorised login |
| Authorisation | Row Level Security in PostgreSQL | Prevents unauthorised data access even with the API key |
| Audit integrity | Postgres trigger (`security definer`) | Audit log cannot be bypassed or faked by the app |
| Admin-only delete | RLS policy | Only the Owner account can delete records |
| Backup auth | Shared secret in GitHub Secrets | Backup endpoint cannot be called by outsiders |
| Secrets management | GitHub Secrets + Supabase env vars | Keys never appear in source code |

---

## Setup Guide

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `tinyledger`
3. Choose a strong database password — **save it somewhere safe**
4. Select region: `Southeast Asia (Singapore)` — closest to India
5. Wait ~2 minutes for provisioning

---

### Step 2 — Run the Database Schema

1. Supabase project → **SQL Editor** → **New Query**
2. Open `supabase/migrations/001_schema.sql` from your repo → click **Raw** on GitHub → copy all
3. Paste into SQL Editor → click **Run**

You should see: `Success. No rows returned.`

Verify tables were created:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```
Should return: `profiles`, `transactions`, `audit_log`, `backup_log`

---

### Step 3 — Create Partner Accounts

Go to **Authentication → Users → Add user → Create new user** for each of the 5 partners.
- Fill in email and password
- Tick **"Auto confirm user"**
- Click **Create user**

After creating all users, check if profiles were auto-created:
```sql
SELECT u.email, p.full_name, p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;
```

If any `full_name` shows NULL, insert the profile manually:
```sql
INSERT INTO public.profiles (id, full_name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'someone@example.com'),
  'Their Full Name',
  'partner'
);
```

Make yourself admin:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

Update partner display names if they defaulted to emails:
```sql
UPDATE public.profiles SET full_name = 'Full Name' WHERE id = 'their-uuid-here';
```

---

### Step 4 — Configure the App

Copy the example env file and fill in your project's values:

```bash
cp .env.example .env.local
```

```bash
# .env.local
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_ORG_NAME=Your Venture Name          # optional, shown on login screen + header
VITE_ORG_TAGLINE=BUSINESS ACCOUNTS       # optional
```

Find `SUPABASE_URL` and the anon key in: **Supabase Dashboard → Settings → API**

`.env.local` is gitignored by default — never commit real credentials to the repo. For production, set the same variables in Cloudflare Pages instead (see Step 7).

One thing env vars don't cover: `index.html`'s `<title>` tag (shown in the browser tab) is static HTML, not read from `.env`. Open `index.html` and change `<title>Tinyledger</title>` to your venture's name if you want the browser tab to match.

Also make sure the Supabase import line reads:
```js
// ✅ Correct
import { createClient } from "@supabase/supabase-js";

// ❌ Wrong — breaks in Vite builds
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

---

### Step 5 — Deploy the Backup Edge Function

Install the Supabase CLI and deploy:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy daily-backup
supabase secrets set BACKUP_SECRET=pick-a-long-random-secret-string
```

Create the private storage bucket:
- **Supabase → Storage → New Bucket**
- Name: `backups`, toggle **Private**
- Click Create

---

### Step 6 — Set Up GitHub Actions

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Value |
|---|---|
| `SUPABASE_FUNCTION_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1` |
| `BACKUP_SECRET` | The same secret you set in Step 5 |

Backups now run automatically every night at 1:00 AM UTC. Trigger manually anytime from the **Actions** tab.

---

### Step 7 — Deploy the Frontend on Cloudflare Pages

This project uses **Cloudflare Pages connected to GitHub** — every `git push` triggers an automatic rebuild and redeploy. No manual steps needed after initial setup.

#### Initial setup (one time only)

1. Go to **dash.cloudflare.com → Workers & Pages → Create**
2. Click the **Pages** tab → **Connect to Git**
3. Authorize Cloudflare and select your repo
4. Fill in build settings:

| Setting | Value |
|---|---|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |

5. Before deploying, add your environment variables: **Settings → Environment variables** and add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_ORG_NAME` / `VITE_ORG_TAGLINE` (same values as your `.env.local`). Without these the build will fail — `App.jsx` intentionally throws an error on startup if they're missing, rather than silently connecting to the wrong project.
6. Click **Save and Deploy**

You get a live URL like `your-project-name.pages.dev` in ~60 seconds. HTTPS is automatic — no configuration needed.

#### Every future update

```bash
git add .
git commit -m "describe your change"
git push
```

Cloudflare detects the push and redeploys within 60 seconds. Watch progress in **Workers & Pages → your project → Deployments**.

#### Manual deploy (no GitHub, one-off)

```bash
npm install
npm run build
# Drag the dist/ folder to Workers & Pages → Create → Pages → Upload assets
```

---

## Hosting Options

| Platform | Cost | Deploy Method | Auto-deploy on push | Notes |
|---|---|---|---|---|
| **Cloudflare Pages** ✅ | Free | GitHub connected | Yes | Used by this project. Built-in DDoS, WAF, free SSL |
| **Netlify** | Free | GitHub or drag dist/ | Yes | Simple UI, good alternative |
| **Vercel** | Free | GitHub or CLI | Yes | Best developer experience |
| **GitHub Pages** | Free | GitHub Actions | Yes | Slightly more config needed |
| **Self-hosted VPS** | ~₹200/month | rsync / Docker | Manual | Full control, most work |

---

## Cost Breakdown

| Service | Plan | Monthly Cost |
|---|---|---|
| Supabase | Free tier (500MB DB, 1GB storage, 50k users) | ₹0 |
| Cloudflare Pages | Free tier (unlimited bandwidth) | ₹0 |
| GitHub | Free (private repos included) | ₹0 |
| Custom domain (optional) | e.g. ledger.yourfarm.in | ~₹800/year |
| **Total** | | **₹0 / month** |

---

## Partner Roles & Permissions

| Action | Partner | Admin (Owner) |
|---|---|---|
| View all transactions | ✅ | ✅ |
| Add new transaction | ✅ | ✅ |
| Edit own transactions | ✅ | ✅ |
| Edit other partners' transactions | ❌ | ✅ |
| Delete any transaction | ❌ | ✅ |
| View audit log | ❌ | ✅ |
| View backup history | ❌ | ✅ |
| View partner balances | ✅ | ✅ |

> "Edit" above applies in full to income/expense transactions. **Settlements are a special case** — see below.

### Editing Settlements

Settlement transactions (created when someone clicks "Settle Up" on the Balances tab) can be edited by the same people as any other transaction — the creator, or an admin — but clicking "Edit" on one opens a small dedicated **Edit Settlement Note** popup instead of the usual full transaction form. It only has a Notes field and Save/Cancel.

This is deliberate: a settlement's amount is tied 1:1 to a specific unsettled `splits` row. If the amount, payer, or date could be edited, the settlement and the split it's supposed to clear would drift out of sync, and the Balances tab would show incorrect numbers. Rather than showing the full form with most fields greyed out, editing a settlement just skips straight to the one thing that's actually safe to change — the note (e.g. a payment reference or method) — via `handleSaveNote()` in `App.jsx`.

To change a settlement's amount or who it's between, delete it (admin only — see `003_fix_settlement_delete.sql`, which automatically reopens the underlying split) and record a new settlement instead.

---

## Transaction Categories

Categories are split by transaction type — the dropdown only shows the relevant list depending on whether you're logging an Expense or Income.

**Expense categories:**
- Seeds & Saplings
- Fertilizers & Pesticides
- Equipment Purchase
- Equipment Repair
- Labor / Wages
- Utilities
- Construction / Building
- Land Procurement
- Miscellaneous Expense

**Income categories:**
- Harvest Sale
- Miscellaneous Income

To add or rename categories, edit the `EXPENSE_CATEGORIES` and `INCOME_CATEGORIES` arrays near the top of `src/App.jsx`. Note: renaming or removing a category here doesn't change existing transactions already saved with the old name — it only affects what's selectable going forward.

---

## Backup & Recovery

Backups run automatically every night at 1:00 AM UTC via GitHub Actions.

Each backup is stored at:
```
backups/daily/YYYY-MM-DD/backup-{timestamp}.json
```

**To restore from a backup:**
1. Go to **Supabase Dashboard → Storage → backups**
2. Navigate to the date folder and download the JSON file
3. The file contains three arrays: `transactions`, `audit_log`, and `profiles`
4. Use the SQL Editor to re-insert rows as needed

**Backup retention:** Last 30 days kept. Older files deleted automatically.

**Manual backup:** GitHub repo → **Actions → Daily Tinyledger Backup → Run workflow**

---

## Database Operations Reference

> Run all commands in: **Supabase Dashboard → SQL Editor → New query**

---

### User Management

**List all users**
```sql
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at ASC;
```

**Find a specific user by email**
```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'someone@example.com';
```

**Check if a user has a matching profile**
```sql
SELECT u.email, p.full_name, p.role, p.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at ASC;
```
> If `full_name` shows NULL, that user is missing a profile row — insert it manually.

**Delete a user (removes profile too via cascade)**
```sql
DELETE FROM auth.users WHERE email = 'someone@example.com';
```
> ⚠️ Permanent. The cascade also deletes their profile row.

---

### Profile Management

**List all profiles**
```sql
SELECT * FROM public.profiles ORDER BY created_at ASC;
```

**List all profiles with role and email together**
```sql
SELECT p.id, p.full_name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role, p.full_name;
```
> Useful for a quick audit of who's admin vs. partner, and to catch `full_name` values that fell back to an email address (see `handle_new_user()` in `001_schema.sql` — if `raw_user_meta_data->>'full_name'` wasn't set at signup, `full_name` defaults to the user's email).

**Check your own role**
```sql
SELECT p.id, p.full_name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'your-login-email@example.com';
```
> ⚠️ Don't use `WHERE id = auth.uid()` here — the SQL Editor runs as the Postgres service role, not as your logged-in app session, so `auth.uid()` returns `NULL` and the query silently matches 0 rows. Filter by email instead. (`auth.uid()` only resolves correctly inside RLS policies and app-side queries made through the Supabase client, not in the SQL Editor.)

**Create a profile manually**
```sql
INSERT INTO public.profiles (id, full_name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'someone@example.com'),
  'Full Name Here',
  'partner'  -- or 'admin'
);
```

**Promote a user to admin**
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'someone@example.com');
```

**Demote admin back to partner**
```sql
UPDATE public.profiles
SET role = 'partner'
WHERE id = (SELECT id FROM auth.users WHERE email = 'someone@example.com');
```

**Update a partner's display name**
```sql
UPDATE public.profiles
SET full_name = 'New Full Name'
WHERE id = 'paste-uuid-here';
```

---

### Transaction Queries

**View all transactions (newest first)**
```sql
SELECT
  t.id, t.date, t.type, t.amount, t.description, t.category,
  p.full_name AS partner,
  cb.full_name AS recorded_by,
  t.note, t.created_at
FROM public.transactions t
JOIN public.profiles p  ON p.id  = t.partner_id
JOIN public.profiles cb ON cb.id = t.created_by
ORDER BY t.date DESC;
```

**Total income, expenses and net balance**
```sql
SELECT
  SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expenses,
  SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END) AS net_balance
FROM public.transactions;
```

**Breakdown by partner**
```sql
SELECT
  p.full_name,
  SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END) AS income,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expenses,
  SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE -t.amount END) AS net
FROM public.transactions t
JOIN public.profiles p ON p.id = t.partner_id
GROUP BY p.full_name
ORDER BY net DESC;
```

**Breakdown by category**
```sql
SELECT category, COUNT(*) AS count, SUM(amount) AS total
FROM public.transactions
GROUP BY category
ORDER BY total DESC;
```

**Monthly summary**
```sql
SELECT
  TO_CHAR(date, 'YYYY-MM') AS month,
  SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses,
  SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END) AS net
FROM public.transactions
GROUP BY TO_CHAR(date, 'YYYY-MM')
ORDER BY month DESC;
```

**Transactions within a date range**
```sql
SELECT * FROM public.transactions
WHERE date BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY date DESC;
```

**Transactions for a specific partner**
```sql
SELECT t.* FROM public.transactions t
JOIN public.profiles p ON p.id = t.partner_id
WHERE p.full_name = 'Partner Full Name'
ORDER BY t.date DESC;
```

**Delete a specific transaction by ID**
```sql
DELETE FROM public.transactions WHERE id = 'paste-transaction-uuid-here';
```
> ⚠️ Triggers the audit log automatically.

**Delete all transactions (reset test data only)**
```sql
DELETE FROM public.transactions;
```
> ⚠️ Only use before going live to clear test entries.

---

### Audit Log Queries

**View full audit log (newest first)**
```sql
SELECT a.created_at, a.user_name, a.action, a.record_id, a.old_data, a.new_data
FROM public.audit_log a
ORDER BY a.created_at DESC
LIMIT 100;
```

**Audit log for a specific user**
```sql
SELECT * FROM public.audit_log
WHERE user_name = 'Partner Full Name'
ORDER BY created_at DESC;
```

**All deletions ever made**
```sql
SELECT * FROM public.audit_log WHERE action = 'DELETE' ORDER BY created_at DESC;
```

**All edits ever made**
```sql
SELECT * FROM public.audit_log WHERE action = 'EDIT' ORDER BY created_at DESC;
```

**Full history of a specific transaction**
```sql
SELECT * FROM public.audit_log
WHERE record_id = 'paste-transaction-uuid-here'
ORDER BY created_at ASC;
```

**Reconstruct a deleted transaction**
```sql
SELECT old_data FROM public.audit_log
WHERE action = 'DELETE' AND record_id = 'paste-transaction-uuid-here';
```

**Count actions per user**
```sql
SELECT user_name, action, COUNT(*) AS count
FROM public.audit_log
GROUP BY user_name, action
ORDER BY user_name, action;
```

---

### Backup Log Queries

**View all backup runs**
```sql
SELECT * FROM public.backup_log ORDER BY created_at DESC;
```

**Last successful backup**
```sql
SELECT * FROM public.backup_log
WHERE status = 'success'
ORDER BY created_at DESC
LIMIT 1;
```

**Any failed backups**
```sql
SELECT * FROM public.backup_log WHERE status = 'failed' ORDER BY created_at DESC;
```

---

### Health Checks

**Row counts across all tables**
```sql
SELECT
  (SELECT COUNT(*) FROM public.profiles)     AS profiles,
  (SELECT COUNT(*) FROM public.transactions) AS transactions,
  (SELECT COUNT(*) FROM public.audit_log)    AS audit_entries,
  (SELECT COUNT(*) FROM public.backup_log)   AS backup_runs;
```

**Confirm all tables exist**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

**Confirm RLS is enabled on all tables**
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
> All four tables should show `rowsecurity = true`.

**Confirm audit trigger is active**
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```
> Should show `trg_audit_transactions` for INSERT, UPDATE, DELETE on `transactions`.

**Check all RLS policies**
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Find duplicate transactions**
```sql
SELECT description, amount, date, COUNT(*) AS duplicates
FROM public.transactions
GROUP BY description, amount, date
HAVING COUNT(*) > 1;
```

**Wipe and re-run schema (dev/test only — destroys all data)**
```sql
DROP TABLE IF EXISTS public.backup_log CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.audit_transactions CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
```
> ⚠️ Run `001_schema.sql` again after this to recreate everything.

---

## Troubleshooting

**Partners tab is blank**
- Supabase import in `App.jsx` is likely wrong. Make sure it reads:
  ```js
  import { createClient } from "@supabase/supabase-js";
  ```
  Not the `esm.sh` URL version. Fix → commit → push → Cloudflare auto-redeploys.

**Login not working**
- Check `SUPABASE_URL` and `SUPABASE_ANON` in `App.jsx` are correct
- Confirm the user exists in **Supabase → Authentication → Users**
- Make sure "Auto confirm user" was ticked when creating the account

**Profile not created after adding a user**
- The auto-trigger sometimes misses if schema wasn't fully set up first
- Check who is missing: `SELECT u.email FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL;`
- Insert manually using the Profile Management queries above

**UPDATE profiles returns "0 rows affected"**
- Profile row doesn't exist yet — insert it first, then update
- Get the exact UUID: `SELECT id, email FROM auth.users;`

**Cloudflare deployment not triggering**
- Check **Workers & Pages → your project → Deployments** for status
- Confirm GitHub is connected: **Settings → Builds & deployments**
- Force a deploy: `git commit --allow-empty -m "trigger deploy" && git push`

**"Permission denied" errors**
- Re-run `001_schema.sql` in SQL Editor to ensure RLS is set up
- Confirm RLS is on: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`

**Backup not running**
- Check **GitHub → Actions** for error logs
- Verify `SUPABASE_FUNCTION_URL` and `BACKUP_SECRET` are set in GitHub Secrets
- Trigger manually: **Actions → Daily Tinyledger Backup → Run workflow**
- Check **Supabase → Edge Functions → daily-backup → Logs**

**Partner can't edit a transaction**
- Partners can only edit transactions they created (`created_by = auth.uid()`)
- Admin account can edit any transaction

**GitHub clone fails with password error**
- GitHub no longer accepts passwords for git operations
- Use a Personal Access Token: **github.com → Settings → Developer settings → Personal access tokens**
- Or use SSH: `git clone git@github.com:username/repo.git`

---

## License

MIT — free to use, fork, modify, and deploy for your own venture. See [LICENSE](./LICENSE) for the full text. No warranty is provided; review the Security Model and Setup Guide before handling real financial data.
