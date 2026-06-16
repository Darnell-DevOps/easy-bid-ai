# Auto-qualification pipeline for leads

Today `lead-response` is only invoked manually from `LeadAssistant`, and the `leads` table only stores raw form responses. Inbound form submissions never get qualified, scored, or routed automatically.

This plan adds a server-side pipeline that runs the moment a lead row is created — no UI action required.

```text
Public form  ──► lead_form_submit RPC ──► INSERT into public.leads
                                                  │
                                                  ▼ (AFTER INSERT trigger via pg_net)
                                          lead-qualify edge fn
                                                  │
                                ┌────────────────-┼────────────────┐
                                ▼                 ▼                 ▼
                         qualification     draft reply       status routing
                         fields on lead     on lead         High→qualified
                                                            Med →new
                                                            Low →archived
```

## Scope

In scope:
- `leads` table additions to hold qualification + draft reply.
- A new `lead-qualify` edge function (service-role internal endpoint).
- DB trigger on `public.leads` that fires the edge function via `pg_net`.
- LeadInbox drawer surfacing qualification fields + draft reply + a "Use draft" copy action.

Out of scope:
- Migrating `inbound-email-webhook` (still writes to `clients` table — separate flow).
- Sending the draft reply automatically — we draft only; the user sends.
- Bulk re-qualification of existing leads (one-off backfill can be added later).

## Schema changes (migration tool)

Add to `public.leads`:
- `service_requested text`
- `budget text`
- `timeline text`
- `goals text`
- `lead_quality text` — `'High' | 'Medium' | 'Low'`
- `ai_recommendation text`
- `draft_reply text`
- `draft_subject text`
- `qualified_at timestamptz`
- `qualification_error text` (records last failure so it's visible/retryable)

No new RLS work needed — existing user-scoped policy on `leads` already covers these.

Enable extensions `pg_net` (for trigger callouts).

## `lead-qualify` edge function

`supabase/functions/lead-qualify/index.ts`, `verify_jwt = false`.

- Validates `x-internal-secret` header against `LEAD_QUALIFY_SECRET`.
- Body: `{ leadId: string }`.
- Uses service-role client to load the lead + its form (field id → label map for richer prompts).
- Builds a message string from `name/email/phone/company/source + labelled responses`.
- Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with a forced tool returning:
  `reply`, `reply_subject`, `service_requested`, `budget`, `timeline`, `goals`, `notes`, `lead_quality`, `quality_reason`, `ai_recommendation`.
- Writes qualification fields + draft reply onto the lead row.
- Auto-routes status:
  - `High` → `qualified`
  - `Medium` → `new` (left for human review)
  - `Low` → `archived`
- Sets `qualified_at = now()`. On AI failure: writes `qualification_error` and leaves status untouched.
- Idempotent: if `qualified_at` is already set, returns early.

## DB trigger (supabase insert tool, not migration)

Per the cron-job guidance, the trigger embeds the project URL + secret, so it's created with the insert tool so it doesn't propagate to remixes.

- Trigger function `public.trigger_lead_qualify()`:
  - On `AFTER INSERT` of `public.leads`, when `NEW.status = 'new'` and `NEW.qualified_at IS NULL`.
  - Calls `net.http_post(url, headers, body)` with `{ leadId: NEW.id }` and the internal secret header.
  - Wrapped in `BEGIN/EXCEPTION WHEN OTHERS THEN PERFORM 1; END;` so a network hiccup never blocks the form submission.

## Secrets

- `LEAD_QUALIFY_SECRET` — random string. Used by both the trigger and the edge function.

## LeadInbox UI

Surface what the pipeline produced (frontend-only changes in `src/pages/LeadInbox.tsx`):

- Drawer header: show `lead_quality` chip (color-coded) next to the existing score badge.
- New "Qualification" section in the drawer with `service_requested`, `budget`, `timeline`, `goals`, `ai_recommendation`.
- New "Draft reply" section with `draft_subject` + `draft_reply` in a readonly textarea, plus a "Copy reply" button (mirrors LeadAssistant's copy pattern).
- "Re-qualify" button that invokes `lead-qualify` (using a thin authenticated wrapper — see note below).

Note: the LeadInbox "Re-qualify" button shouldn't expose the internal secret to the browser. Easiest fix is a tiny second edge function `lead-requalify` (`verify_jwt = false` but checks the caller's JWT and confirms `leads.user_id = auth.uid()`) that then calls into the same shared qualification logic. Will extract the AI/update code into a shared helper used by both functions.

## Verification

- After deploy: submit the public lead form preview, then in LeadInbox confirm the new row appears with `lead_quality`, `draft_reply`, etc. populated within a few seconds and status routed correctly.
- Force an AI failure path (e.g. temporarily wrong key) and confirm `qualification_error` is set and the lead is still ingested.
- Hit `lead-qualify` directly without the secret header → expect 401.

## Files

Create:
- `supabase/functions/lead-qualify/index.ts`
- `supabase/functions/lead-requalify/index.ts`
- `supabase/functions/_shared/lead-qualify.ts` (shared AI + update helper)

Edit:
- `src/pages/LeadInbox.tsx` (drawer additions, Re-qualify button)

Migration:
- Add columns to `public.leads`; enable `pg_net`.

Insert-tool SQL (project-specific):
- Trigger function + `AFTER INSERT` trigger on `public.leads`.
