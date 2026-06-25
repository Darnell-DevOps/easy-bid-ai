# AI lead qualification — Hot / Warm / Cold / Unclear

The inbound webhook and Lead Assistant already extract `lead_quality` (High/Medium/Low), `quality_reason`, `service_requested`, `budget`, `timeline`, and `ai_recommendation`. This plan **adds** the new fields the user asked for without touching what's already working.

## New per-lead fields

Stored on `public.clients` (and emitted by the AI):

- `lead_score` — `Hot | Warm | Cold | Unclear`
- `lead_score_reason` — short sentence the AI must justify the score with
- `missing_info` — `text[]` of qualification gaps (e.g. `["budget", "timeline", "decision maker"]`)

Existing fields are reused as-is:
- `service_requested`, `budget`, `timeline` → "Detected service / budget / timeline"
- `ai_recommendation` → "Recommended next step"
- `lead_quality` / `quality_reason` → kept for backwards compatibility (Hot/Warm/Cold/Unclear is shown alongside, not in place of it)

## Database

Single migration:
- `ALTER TABLE public.clients ADD COLUMN lead_score text` with `CHECK (lead_score IN ('Hot','Warm','Cold','Unclear'))`
- `ADD COLUMN lead_score_reason text`
- `ADD COLUMN missing_info text[]`
- Backfill: derive `lead_score` from existing `lead_quality` for current rows (`High→Hot`, `Medium→Warm`, `Low→Cold`, null→`Unclear`) so older leads still render.

No new table, no RLS changes (clients RLS already scopes by `user_id`).

## AI schema changes

Update both `draft_lead_reply` tool definitions:
- `supabase/functions/inbound-email-webhook/index.ts`
- `supabase/functions/_shared/lead-qualify.ts`

Add three required fields to the tool schema and prompt:
- `lead_score` (enum: Hot/Warm/Cold/Unclear)
- `lead_score_reason` (string ≤ 200 chars)
- `missing_info` (array of strings, max 6 items)

Prompt guidance added to the system message:
- Hot = clear intent + budget OR timeline OR explicit ask for proposal/call
- Warm = clear intent, missing one of budget/timeline/scope
- Cold = vague intent, no qualification signals
- Unclear = AI can't tell (also used when `lead_confidence = low`)
- `missing_info` lists what would push the score up (budget, timeline, scope, decision maker, contact method, etc.)

## Write-through

In the inbound webhook insert payload, add (when AI returned them):
- `lead_score`, `lead_score_reason`, `missing_info`

Same additions in `_shared/lead-qualify.ts` `update` payload so manually re-qualified leads also get scored.

Dedupe path (existing client appended to thread) gets a lightweight update too: bump `lead_score` only if the new score is **higher** than the stored one (Hot > Warm > Cold > Unclear) so a follow-up email can promote a lead but never demote it.

## UI surfacing (additive only)

`src/pages/ClientDetail.tsx` — existing "Lead Intelligence" card gets a new top row:
- A colored Hot/Warm/Cold/Unclear pill (red / amber / slate / muted)
- `lead_score_reason` as a one-liner
- A "Missing info" chip group rendered from `missing_info` when non-empty
- Existing `lead_quality`, `service_requested`, `budget`, `timeline`, `ai_recommendation` blocks are left in place

`src/pages/LeadInbox.tsx` — list row shows the score pill next to the existing quality badge; detail pane shows score reason + missing info above the current quality block.

`src/pages/LeadAssistant.tsx` — qualification form gets a read-only "AI score" badge with reason; no edit UI for the new fields (AI-owned).

No changes to the proposal, contract, or onboarding flows.

## Technical notes

- Score ordering helper lives in `src/lib/leadScore.ts` (`scoreRank`, `scoreTone`) so list, detail, and dedupe logic share one source of truth.
- `missing_info` is rendered with `Badge variant="outline"`; empty array hides the row entirely.
- No new edge functions, no new cron, no new RPCs.
- After the migration runs, redeploy `inbound-email-webhook` and `lead-response` so the new tool schema ships.
