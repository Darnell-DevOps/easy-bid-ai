## AI Sales Coach + Deal Intelligence

A proactive AI layer across CloseSync that scores every deal, audits every proposal, flags churn risk on retainers, and surfaces a single "Coach" feed telling the user exactly what to do next — and why.

This is additive only. No existing feature changes behavior.

---

## What the user gets

**1. Deal Score (0–100)**
Every proposal gets an AI-computed close probability with a one-line reason ("Viewed 3x in 48h, no booking — high intent, follow up today"). Shown as a badge on the proposal card and inside `ProposalView`.

**2. Proposal Audit**
A "Run AI Audit" button on each draft proposal. Returns:
- Pricing verdict (underpriced / fair / overpriced + suggested range)
- Scope clarity score
- Missing sections (timeline, deliverables, terms)
- 3 concrete rewrite suggestions
- Predicted close probability before sending

**3. Churn Risk on Retainers**
For active retainers, AI flags risk based on payment history, failed payments, age, communication gaps. Shown on `RetainerDetail` and the Retainers list.

**4. AI Coach Feed (new dashboard widget)**
Replaces nothing — sits above `PriorityActions`. A ranked list of AI-generated next actions across the whole business:
- "Re-engage Acme Co — opened proposal 4x but no response (72% close odds)"
- "Raise prices on SEO retainer template — your last 5 closed 20% above ask"
- "Sarah's retainer at churn risk — payment failed once, no contact in 14 days"
- "Best time to send proposals: Tue 10am (your data)"

Each item has a one-click action button.

**5. Weekly AI Briefing**
A generated summary card on the dashboard: wins, losses, what to focus on this week, and one specific recommendation.

---

## Technical design

### Database (1 new table + 2 columns)

```sql
-- Cached AI insights so we don't re-run the model on every page load
create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null,        -- 'proposal' | 'retainer' | 'dashboard' | 'audit'
  entity_id uuid,                   -- nullable for dashboard-wide insights
  kind text not null,               -- 'deal_score' | 'audit' | 'churn_risk' | 'coach_feed' | 'weekly_briefing'
  score integer,                    -- 0-100 where applicable
  severity text,                    -- 'info' | 'warning' | 'critical'
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  recommended_action text,
  action_url text,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,           -- regen after this
  dismissed_at timestamptz
);
-- RLS: user_id = auth.uid() for all CRUD
```

Cache TTLs: deal_score 6h, churn_risk 12h, coach_feed 1h, weekly_briefing 7d, audit never expires (manual re-run).

### Edge functions (4 new, all using Lovable AI Gateway)

| Function | Purpose | Model |
|---|---|---|
| `ai-deal-score` | Score one proposal; called on proposal view + nightly batch | `google/gemini-3-flash-preview` |
| `ai-proposal-audit` | Deep audit of a draft proposal (pricing, scope, rewrite tips) | `google/gemini-2.5-pro` |
| `ai-churn-risk` | Score one retainer for churn risk | `google/gemini-3-flash-preview` |
| `ai-coach-feed` | Generate prioritized action list + weekly briefing for the whole account | `google/gemini-2.5-pro` |

All use structured tool-calling output (no JSON-in-prose parsing). All write into `ai_insights`. All read user context (proposals, retainers, payments, bookings) via service-role client.

### Frontend (new + light edits)

**New components**
- `src/components/ai/DealScoreBadge.tsx` — colored 0–100 badge + tooltip with reason
- `src/components/ai/ProposalAuditPanel.tsx` — collapsible panel inside `NewProposal` / `ProposalView`
- `src/components/ai/ChurnRiskCard.tsx` — risk indicator inside `RetainerDetail`
- `src/components/dashboard/CoachFeedWidget.tsx` — main AI Coach feed for `Dashboard`
- `src/components/dashboard/WeeklyBriefingCard.tsx` — weekly briefing card

**New hook**
- `src/hooks/use-ai-insight.ts` — generic `useInsight(entityType, entityId, kind)` that reads cache, triggers regen if stale, and returns `{ insight, loading, refresh }`

**Light edits** (non-breaking, additive)
- `Dashboard.tsx` — add `<WeeklyBriefingCard />` and `<CoachFeedWidget />` above `PriorityActions`
- `ProposalsDashboard.tsx` / `ProposalsList.tsx` — render `<DealScoreBadge>` per row
- `ProposalView.tsx` — show deal score next to status
- `NewProposal.tsx` — add "Run AI Audit" button → `<ProposalAuditPanel>`
- `RetainerDetail.tsx` + `RetainersPage.tsx` — render `<ChurnRiskCard>`

### Animations
Reuse the existing premium animation system (shimmer for AI generation, fade-in for results). Score numbers count up on mount. Subtle pulse on high-priority coach items.

### Cost & rate limiting
- All AI calls cached in `ai_insights` with TTL — UI reads cache first
- `ai-coach-feed` rate-limited to once per hour per user (server-side check via `generated_at`)
- Audit is on-demand only (user clicks the button)
- Surface 402 (credits) and 429 (rate limit) errors as toasts

---

## Files

**Created**
- `supabase/migrations/<ts>_ai_insights.sql`
- `supabase/functions/ai-deal-score/index.ts`
- `supabase/functions/ai-proposal-audit/index.ts`
- `supabase/functions/ai-churn-risk/index.ts`
- `supabase/functions/ai-coach-feed/index.ts`
- `src/lib/ai-coach.ts` (shared types + helpers)
- `src/hooks/use-ai-insight.ts`
- `src/components/ai/DealScoreBadge.tsx`
- `src/components/ai/ProposalAuditPanel.tsx`
- `src/components/ai/ChurnRiskCard.tsx`
- `src/components/dashboard/CoachFeedWidget.tsx`
- `src/components/dashboard/WeeklyBriefingCard.tsx`

**Edited (additive only)**
- `src/pages/Dashboard.tsx`
- `src/pages/ProposalsDashboard.tsx`
- `src/components/dashboard/ProposalsList.tsx`
- `src/pages/ProposalView.tsx`
- `src/pages/NewProposal.tsx`
- `src/pages/RetainerDetail.tsx`
- `src/pages/RetainersPage.tsx`
- `supabase/config.toml` (register new functions, `verify_jwt = true` — these need user context)

---

## Out of scope (future)
- Auto-sending follow-ups (currently AI suggests, user clicks)
- Voice/email transcript analysis
- A/B testing proposal templates
- Multi-account benchmarking ("agencies like yours close at 34%")
