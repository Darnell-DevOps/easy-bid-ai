## Goal
Track every step of the AI lead pipeline as activity entries, and surface counts on the dashboard.

## 1. New `lead_activity` table (schema)
A single append-only log so the feed and metrics share one source of truth.

Columns (beyond id/created_at):
- `user_id uuid` (RLS scope)
- `client_id uuid` nullable (FK to clients)
- `lead_id uuid` nullable (FK to leads, for form-based leads)
- `proposal_id uuid` nullable
- `type text` — one of:
  - `lead_email_received`
  - `lead_qualified`
  - `reply_drafted`
  - `reply_sent`
  - `intake_form_sent`
  - `proposal_created_from_lead`
  - `lead_marked_not_a_lead`
- `title text`, `summary text`
- `metadata jsonb` (subject, score, channel, etc.)

RLS: user reads own; service_role full. Grants for `authenticated` SELECT, `service_role` ALL. Indexed on `(user_id, created_at desc)` and `(user_id, type)`.

## 2. Emit activity from existing code paths
Insert rows at the points where each event already happens — no new business logic.

- `supabase/functions/inbound-email-webhook/index.ts`
  - After classification → insert `lead_email_received` (always, with classification in metadata).
  - After AI qualify success → insert `lead_qualified` (with score, confidence).
  - After draft saved → insert `reply_drafted`.
- `supabase/functions/lead-qualify/index.ts` & `_shared/lead-qualify.ts`
  - On successful qualification → insert `lead_qualified` + `reply_drafted` (form-based leads).
- `supabase/functions/send-lead-reply/index.ts`
  - On successful send → insert `reply_sent`.
- `src/pages/ClientDetail.tsx` Lead Summary actions
  - "Send intake form" handler → insert `intake_form_sent`.
  - "Create proposal" navigation → insert `proposal_created_from_lead` once proposal exists (do it in the proposal-create flow keyed off a `from_lead_client_id` param so it fires regardless of entry point).
  - "Mark as not a lead" → insert `lead_marked_not_a_lead`.

All inserts wrapped in try/catch so a logging failure never breaks the user-facing action.

## 3. Dashboard feed widget
Reuse the existing `RecentActivity` slot pattern in `src/pages/Dashboard.tsx`.

- New `src/components/dashboard/LeadActivityFeed.tsx`
  - Pulls last 10 rows from `lead_activity` for `auth.uid()`.
  - Icon + colour per `type`, relative time, click-through to the client/lead detail.
- Placed alongside `DealActivity` / `RecentActivity` so the user sees lead lifecycle + deal lifecycle side by side.

## 4. Dashboard metrics
Add a new `LeadFunnelMetrics` card group on the dashboard (above the existing stats grid, scoped to "Last 30 days"):

- New leads — count of `lead_email_received` rows ∪ leads created via forms in window
- Qualified leads — count of `lead_qualified`
- Replies drafted — count of `reply_drafted`
- Replies sent — count of `reply_sent`
- Proposals from leads — count of `proposal_created_from_lead`

Implementation:
- New component `src/components/dashboard/LeadFunnelMetrics.tsx` (5 small stat tiles, matching existing `StatsCards` styling).
- Single Supabase query: `select type, count(*) from lead_activity where user_id = $me and created_at > now() - 30d group by type`.
- Wired into `Dashboard.tsx` between hero stats and the activity feeds.

## 5. Lead Assistant page integration
On `src/pages/LeadAssistant.tsx`, add a compact "Recent lead activity" section under the inbound review queue so users can audit the AI pipeline in one place.

## Out of scope
- No changes to existing dashboard cards' counts (Total Clients, Proposals, etc.).
- No backfill of historic events — feed starts from the moment of deploy.
- No email/Slack notifications for activity entries (in-app feed only).

## Files touched
- New SQL migration for `lead_activity` table.
- New: `src/components/dashboard/LeadActivityFeed.tsx`, `src/components/dashboard/LeadFunnelMetrics.tsx`.
- Edit: `Dashboard.tsx`, `LeadAssistant.tsx`, `ClientDetail.tsx`.
- Edit edge functions: `inbound-email-webhook`, `send-lead-reply`, `lead-qualify`, `_shared/lead-qualify.ts`.
