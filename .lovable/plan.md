
# Founder Analytics Dashboard

A private `/admin` area only you can see, with platform-wide stats and per-user drilldown. Pulls product usage from the database and authoritative revenue/MRR from Paddle.

---

## 1. Super-admin role (foundation)

Create a proper role system so you (and only you) can read across all users without breaking the existing per-user RLS.

- New enum `app_role` with values `super_admin`, `user`
- New table `user_roles (user_id, role)` with RLS — users can read their own role, no one can write (you'll be inserted manually via a one-time data insert)
- `has_role(_user_id, _role)` SECURITY DEFINER function (avoids RLS recursion)
- `is_super_admin()` convenience wrapper that checks `auth.uid()`
- Add permissive `super_admin` SELECT policies to: `clients`, `proposals`, `contracts`, `bookings`, `retainers`, `retainer_invoices`, `onboarding_forms`, `email_send_log`, `ai_insights`. These run alongside existing `auth.uid() = user_id` policies — regular users are unaffected, you get full read access.
- One-time insert: grant `super_admin` to your user_id

---

## 2. `/admin` route + access guard

- New route `/admin` registered in `src/App.tsx`, wrapped in `AuthGuard` + a new `SuperAdminGuard` that calls `is_super_admin()` and redirects non-admins to `/dashboard`
- Hidden from regular nav; only shows a small "Admin" link in `DashboardLayout` if `is_super_admin()` returns true
- Visual style matches existing premium dark dashboard (no redesign)

---

## 3. Founder dashboard sections

### a) Users & growth (from DB + auth.users)
Stats cards + chart:
- Total signups, new signups (24h / 7d / 30d)
- Active users (users who created/updated any row in last 7d / 30d)
- Signups-over-time line chart (daily, last 90d)
- Read via a SECURITY DEFINER RPC `admin_user_stats()` that joins `auth.users` with activity tables (auth.users isn't directly queryable from JS)

### b) Revenue & MRR (DB + Paddle, side by side)
Two columns:
- **From DB**: sum of `proposals.amount_cents` where `client_paid = true`, sum of `retainer_invoices.amount_cents` where `status = 'paid'`, count of paid invoices, breakdown by month
- **From Paddle (live)**: MRR, active subscribers, revenue last 30d — fetched via a new edge function `admin-paddle-metrics` that calls `/metrics/monthly-recurring-revenue`, `/metrics/active-subscribers`, `/metrics/revenue` using `getPaddleClient('live')`. Function gated to super_admin via JWT check.

### c) Product usage (from DB)
Stat cards:
- Total proposals (created / sent / accepted / paid)
- Total contracts (sent / signed)
- Total bookings
- Total clients tracked
- Emails sent last 7d (from `email_send_log`, dedup by `idempotency_key`, group by status)

### d) Per-user drilldown
Table with search + sort:
- Columns: email, signup date, last active, # clients, # proposals, # contracts signed, total revenue (DB), Paddle subscription status
- Click row → side panel with that user's full breakdown + recent activity timeline
- Backed by a single RPC `admin_user_list(search, limit, offset)` that pre-aggregates counts per user (one query, not N+1)

---

## 4. Files

**Migration** (1):
- `app_role` enum, `user_roles` table + RLS, `has_role` + `is_super_admin` functions, super_admin SELECT policies on 9 tables, `admin_user_stats` + `admin_user_list` + `admin_revenue_stats` RPCs

**Data insert** (1):
- Grant super_admin to your user_id

**Edge function** (1):
- `supabase/functions/admin-paddle-metrics/index.ts` — verifies JWT + super_admin role, returns MRR/subscribers/revenue from Paddle live env

**Frontend** (~6 small files):
- `src/pages/AdminDashboard.tsx` — page shell with 4 sections
- `src/components/admin/SuperAdminGuard.tsx`
- `src/components/admin/UsersGrowthSection.tsx` (with recharts line chart)
- `src/components/admin/RevenueSection.tsx` (DB + Paddle side by side)
- `src/components/admin/UsageSection.tsx`
- `src/components/admin/UsersTable.tsx` (search + drilldown panel)
- `src/hooks/useIsSuperAdmin.ts`
- Edits: `src/App.tsx` (route), `src/components/DashboardLayout.tsx` (conditional Admin link)

---

## Out of scope (can add later)
- Cohort retention analysis, funnel charts, churn prediction
- Manual user actions (impersonate, suspend, refund) — read-only for now
- Exporting CSV reports
- Real-time updates (page refresh on demand only)
- Multiple admin tiers — just one `super_admin` role
