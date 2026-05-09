## Root cause

Your `admin@closesync.io` account has the `super_admin` role. The database has broad RLS policies on every data table named **"Super admins read all X"** that let any super admin SELECT *every* user's rows directly. The dashboards (`Dashboard`, `RevenueDashboard`, `ProposalsDashboard`, `RecentActivity`, etc.) use plain `supabase.from('proposals').select(...)` and rely on RLS to scope by user — so when you log in as the super admin, RLS returns **everyone's** proposals, contracts, clients, retainers, bookings, retainer invoices, ai_insights, and email logs as if they were yours.

Confirmed by querying the DB:
- `admin@closesync.io` is the only `super_admin`
- All existing data belongs to `darnellmckenzie@hotmail.com` and `sanmi.alao2@yahoo.com` (no rows belong to admin)
- Yet the admin dashboard sees them all because of the super-admin SELECT policy

The `/admin` page itself does **not** rely on these policies — it uses dedicated `SECURITY DEFINER` RPCs (`admin_user_list`, `admin_revenue_stats`, `admin_usage_stats`) which already enforce the super-admin check internally. So the broad SELECT policies are vestigial and only cause harm.

## Fix

Drop the "Super admins read all X" SELECT policies from these tables:

- `proposals`
- `contracts`
- `clients`
- `retainers`
- `retainer_invoices`
- `bookings`
- `onboarding_forms`
- `ai_insights`
- `email_send_log`

After this, every account — including super admins — will only see their own rows in normal app pages. The `/admin` page keeps working because it goes through the SECURITY DEFINER RPCs.

### What this changes for you

- ✅ Each account sees only its own data in dashboards, proposals list, contracts, clients, retainers, etc.
- ✅ `/admin` page still shows aggregate stats and the user list (uses RPCs, not direct selects)
- ⚠️ As a super admin, you can no longer "browse other users' actual rows" through the regular app pages — only see aggregates in `/admin`. If you ever need row-level cross-user access, we'd build it as a dedicated admin RPC.

### Files / changes

1. **Migration** — drop 9 policies (one DROP POLICY per table, no schema changes)
2. **No frontend changes needed** — the dashboards already query `.from('table').select()` and will start respecting per-user scoping automatically.

### Verification

After applying, log in as admin@closesync.io and the dashboards should be empty (since admin owns no proposals/contracts/clients). Log in as one of the other accounts to confirm they still see their own data.