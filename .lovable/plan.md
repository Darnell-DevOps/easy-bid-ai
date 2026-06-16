# Enable auto-qualification on new leads

You picked option 1: create the database trigger that auto-runs the `lead-qualify` edge function whenever a new lead arrives.

## What's already in place

- `leads` table has qualification columns (`lead_quality`, `ai_recommendation`, `draft_reply`, `qualified_at`, etc.)
- `pg_net` extension is enabled (lets Postgres make HTTP calls)
- `lead-qualify` edge function is deployed and expects an `x-internal-secret` header
- `trigger_lead_qualify()` function already exists in the DB but contains a placeholder secret (`REPLACE_WITH_YOUR_LEAD_QUALIFY_SECRET`) and is not attached to the table yet

## What this plan does

### 1. Create the `LEAD_QUALIFY_SECRET` runtime secret
Used by both the edge function (to validate incoming calls) and the DB trigger (to authenticate outbound calls). You'll be prompted to enter a value — any long random string works (e.g. a UUID or 32+ random chars).

### 2. Store the secret inside Postgres so the trigger can read it
The trigger runs inside the database and cannot read edge-function env vars. Standard pattern: store it as a custom GUC via `ALTER DATABASE ... SET app.lead_qualify_secret = '...'` and read it with `current_setting('app.lead_qualify_secret', true)` inside the trigger.

Since `ALTER DATABASE` is forbidden in migrations on this stack, I'll use a small `vault`-free alternative: a dedicated single-row table `internal_config` (service_role only, RLS locked, no anon/auth grants) that the SECURITY DEFINER trigger reads.

### 3. Rewrite `trigger_lead_qualify()` to read the secret from `internal_config`
Removes the hardcoded placeholder.

### 4. Attach the trigger to `leads`
```text
CREATE TRIGGER leads_auto_qualify
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trigger_lead_qualify();
```
Fires only when `qualified_at IS NULL` and `status = 'new'` (already guarded inside the function). HTTP failures are swallowed so lead ingestion never breaks.

### 5. Seed the secret value into `internal_config` after you provide it

## Steps in order

1. Prompt you for `LEAD_QUALIFY_SECRET` via the secrets tool
2. Migration: create `internal_config` table (locked down), rewrite `trigger_lead_qualify()`, attach trigger to `leads`
3. Insert the secret value into `internal_config`
4. Test: submit a lead through an existing lead form and verify `qualified_at`, `lead_quality`, and `draft_reply` populate within a few seconds

## Technical notes

- `internal_config` will have RLS enabled with no policies — only SECURITY DEFINER functions (running as table owner) can read it
- The trigger is `AFTER INSERT`, non-blocking — `pg_net` queues the HTTP call asynchronously
- Manual re-qualify button in `LeadInbox` (already built) continues to work via `lead-requalify`
