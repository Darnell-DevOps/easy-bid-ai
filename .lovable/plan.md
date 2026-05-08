## Empty States & First-Run Polish

Goal: the first time a user lands anywhere in the app, they should see *what this section is for* and *a single button to populate it* — not a blank panel or a one-line "No X yet" string. No new features, no design changes to populated states, no business logic changes.

### Principle: every empty state has 3 elements

1. An icon (already in each widget — reuse it)
2. A one-line **what this is** + one-line **why it matters**
3. A single primary CTA that takes the user to the page that creates the first item

Same visual language as the rest of the app: existing card surfaces, muted text, accent-colored CTA. Nothing new in the design system.

### Scope — files to update

**Dashboard widgets (sidebar + main column):**
- `src/components/dashboard/PipelineView.tsx` — when all 5 stage counts are 0, replace the funnel with a teaching card ("Your deals will flow through here. Start by adding a lead." → Add Client)
- `src/components/dashboard/RetainersWidget.tsx` — upgrade the one-line "No retainers yet" into a proper empty card explaining MRR + CTA to `/dashboard/retainers/new`
- `src/components/dashboard/ContractsWidget.tsx` — same treatment, CTA to first contract flow
- `src/components/dashboard/OnboardingWidget.tsx` — explain what client onboarding forms do + CTA
- `src/components/dashboard/UpcomingBookings.tsx` — explain booking link + CTA to share booking page / settings
- `src/components/dashboard/CoachFeedWidget.tsx` — current empty state says "Click refresh." Improve to: "AI Coach watches your pipeline and tells you exactly which deal to nudge today. Add a lead or proposal to get your first move." (auto-hide refresh hint when there's literally nothing to coach on)
- `src/components/dashboard/DealActivity.tsx` / `RecentActivity.tsx` — short teaching empty state
- `src/components/dashboard/ProposalsList.tsx` — already has an empty state; audit it and align tone
- `src/components/dashboard/PriorityActions.tsx` — when there's nothing urgent, current copy is already friendly; light tone pass only

**Full pages (when the user lands and the list is empty):**
- `src/pages/RecoveryDashboard.tsx` — "No failed payments. When a retainer payment fails, it lands here with a one-click recovery link to send the client."
- `src/pages/RetainersPage.tsx` — explain retainers + CTA
- `src/pages/ContractsPage.tsx` — explain contracts + CTA
- `src/pages/OnboardingDashboard.tsx` — explain client onboarding forms + CTA
- `src/pages/ProposalsDashboard.tsx` — verify empty state quality
- `src/pages/Clients.tsx` — verify empty state quality

### Shared component

Create `src/components/EmptyState.tsx` — a small presentational component:

```
<EmptyState
  icon={Repeat}
  title="No retainers yet"
  description="Retainers turn one-time clients into monthly recurring revenue. Set up auto-billing in under 2 minutes."
  ctaLabel="Create your first retainer"
  ctaHref="/dashboard/retainers/new"
  variant="card" | "inline"  // card = full panel, inline = small widget version
/>
```

Reused everywhere above. Keeps tone and spacing consistent. Uses existing tokens — no new colors, gradients, or shadows.

### Copy tone

Short, concrete, benefit-led. Examples:

- Pipeline (empty): **"Your deals will live here."** "As you add leads and send proposals, you'll watch them move from New → Sent → Paid." → *Add your first client*
- Coach Feed (empty): **"Your AI coach is ready."** "Add a client or proposal and the coach will tell you the single highest-leverage move to make today." → *Add a client*
- Recovery (empty): **"All payments healthy."** "When a retainer payment fails, it appears here with a one-click recovery link you can send the client."
- Retainers widget (empty): **"Turn clients into recurring revenue."** "Set up monthly billing in under 2 minutes." → *Create retainer*

### Out of scope

- No changes to populated-state UI
- No new widgets, routes, or data
- No changes to the design system, colors, or typography
- No mobile-specific layout changes (separate pass)
- No analytics instrumentation (separate pass)

### Deliverable

One shared `EmptyState` component + ~10 widgets/pages updated to use it. After this, a brand-new signup landing on the dashboard sees a guided, opinionated experience instead of a sea of "0" and "—" placeholders.
