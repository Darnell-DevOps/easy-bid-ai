## Goal

Score raw inbound leads 0–100 so users can triage the Lead Inbox at a glance — same UX pattern as `DealScoreBadge`, but for entries in the `leads` table (not proposals).

## Scope

1. **New edge function `ai-lead-score`** (`supabase/functions/ai-lead-score/index.ts`)
   - Auth: requires user JWT, RLS-scoped Supabase client (mirrors `ai-deal-score`).
   - Input: `{ leadId }`.
   - Loads the lead + its `lead_forms` row (for form name/fields) so field IDs in `responses` can be paired with their labels.
   - Builds an AI context: contact completeness (email/phone/company present?), response richness (answers length, count), intent signals (budget/timeline keywords in answers), source, age, status.
   - Calls Lovable AI (`google/gemini-3-flash-preview`) via the existing `callAITool` helper with a `score_lead` tool returning `{ score, reason, recommended_action }`.
   - Saves via `saveInsight({ entityType: "lead", kind: "lead_score", entityId: leadId, ... })`.
   - Severity: ≥60 info, ≥30 warning, else critical (same thresholds as deal score).

2. **Types** (`src/lib/ai-coach.ts`)
   - Extend `InsightKind` with `"lead_score"`.
   - Extend `InsightEntityType` with `"lead"`.
   - Add `lead_score: 12 * 60 * 60 * 1000` (12h TTL) to `INSIGHT_TTL_MS`.

3. **New component `LeadScoreBadge`** (`src/components/ai/LeadScoreBadge.tsx`)
   - Same shape as `DealScoreBadge`: uses `useAIInsight` with `entityType: "lead"`, `kind: "lead_score"`, `functionName: "ai-lead-score"`, payload `{ leadId }`.
   - Two sizes (`sm` for table row, `md` for drawer header).
   - Shows "Scoring…" pill while generating, tooltip with reason + recommended action when ready.

4. **Wire into `LeadInbox`** (`src/pages/LeadInbox.tsx`)
   - Add a "Score" column in the table (after Status, hidden on mobile) rendering `<LeadScoreBadge leadId={l.id} size="sm" />`.
   - In the side-sheet header, show `<LeadScoreBadge leadId={selected.id} size="md" />` next to the name, plus a "Re-score" button calling `refresh()` (exposed by `useAIInsight`).
   - Skip auto-scoring for `archived` and `converted` leads via the badge's `enabled` prop (prevents wasted credits).

## Technical Notes

- `ai_insights` schema already stores `entity_type`/`kind` as free-text + has indexes on `(entity_type, entity_id)` — no DB migration needed.
- RLS on `ai_insights` is already user-scoped; saving with `entity_type: "lead"` works without policy changes.
- No new secrets; reuses `LOVABLE_API_KEY` already wired into `_shared/ai-coach.ts`.
- Edge function deploys automatically.

## Out of Scope

- Persisting score on the `leads` table itself (insights table is the single source of truth, matches deal scoring).
- Sorting/filtering the inbox by score (can come later if useful).
- Bulk re-score / background cron.
