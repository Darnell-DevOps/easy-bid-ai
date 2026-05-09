## Landing → Signup Conversion Pass

Goal: lift conversion from the marketing page without redesigning it. Add lightweight analytics, a self-running 60-second interactive demo, and stronger social proof. No backend changes, no design system changes, no new routes added beyond what's needed.

### 1. Lightweight analytics (no third-party SDK)

Add a tiny first-party event logger that writes to a new public `landing_events` table via the existing Supabase client.

- New table `landing_events` (RLS: anon `INSERT` only, no `SELECT` for anon — owner-readable later if we need a dashboard).
  - `id uuid pk`, `created_at timestamptz default now()`, `event text`, `path text`, `referrer text`, `session_id text`, `meta jsonb`.
- New helper `src/lib/landing-analytics.ts`:
  - `track(event, meta?)` — fires fire-and-forget insert; no PII.
  - Generates a per-session id stored in `sessionStorage`.
- Instrument key landing events:
  - `landing_view` (mount of `Index.tsx`)
  - `cta_click` with `meta.location` ∈ `{ hero, nav, sticky, pricing_free, pricing_pro, final, demo }`
  - `demo_start`, `demo_complete`
  - `sample_view` (already-existing "View Sample Proposal" button)
  - `signup_view` and `signup_submit_success` (in `Signup.tsx`)
- Zero blocking — every call is wrapped in try/catch and never awaits.

### 2. Self-running "See it work in 60s" interactive demo

A new section `src/components/landing/LiveDemo.tsx` placed between the hero and the existing "Money Moment" section.

- Three-stage choreographed mock that loops every ~18s, with a manual progress bar + Play/Pause control:
  1. Compose proposal (typing animation fills client name, scope, price)
  2. Client opens proposal (tilted card slides in, "Viewed" badge appears, accept button pulses)
  3. Payment received (counter ticks up to £4,800, confetti-style accent glow)
- Built with React state + `setInterval` (NOT Remotion — this is the live site).
- "Start free trial" CTA appears at end of cycle with `track('cta_click', { location: 'demo' })`.
- Fully presentational: no real backend calls, no auth.
- Respects `prefers-reduced-motion` — falls back to a static three-frame view.

### 3. Touch-ups directly tied to conversion

- Hero secondary CTA: change `View Sample Proposal` to `See 60-second demo` (anchor to `#live-demo`); keep "View sample" as a smaller text link below the row.
- Add `id="live-demo"` and update nav anchors so the new section is reachable from the sticky nav (insert "Demo" between Logo and "How it works").
- Annotate every CTA on the page with `onClick={() => track('cta_click', { location })}` — no visual change.

### Out of scope

- No third-party analytics (PostHog/GA) — keep stack first-party
- No real customer logos or fabricated metrics
- No A/B testing infra
- No new routes
- No design system / color changes

### Files

- New: `supabase/migrations/<timestamp>_landing_events.sql`
- New: `src/lib/landing-analytics.ts`
- New: `src/components/landing/LiveDemo.tsx`
- New: `src/components/landing/Testimonials.tsx`
- Edited: `src/pages/Index.tsx` (mount tracking, swap proof block, insert LiveDemo, CTA tracking)
- Edited: `src/pages/Signup.tsx` (page-view + submit-success tracking)

### Deliverable

Landing page that: (a) tells us which CTAs/sections actually convert, (b) lets a curious visitor watch the product work end-to-end in under a minute without leaving the page, and (c) feels backed by real human voices instead of one anonymous line.