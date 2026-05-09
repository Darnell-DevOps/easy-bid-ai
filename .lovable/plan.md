## Mobile Polish Pass

Goal: make the existing dashboard and core pages feel native at 360–414px width. **No new features, no design system changes, no business logic changes** — only responsive layout, spacing, and overflow fixes.

### Principle

Match the polish of the desktop view at mobile widths. Single-column where appropriate, horizontal-scroll where information density matters (pipeline, tables), tap targets ≥40px, no horizontal page scroll, no clipped numbers or buttons.

### Scope — what gets fixed

**Dashboard shell (`DashboardLayout.tsx`)**
- Audit sidebar/topbar at <640px: confirm the mobile drawer behaves, close on route change, and that the topbar CTA row doesn't wrap awkwardly.
- Reduce hero (`Sales Command Center` heading + subtitle) padding on mobile.

**Top of dashboard (`Dashboard.tsx`)**
- Hero card ("Create a proposal and get paid faster"): stack buttons full-width on mobile, reduce padding from `p-7 sm:p-8` baseline.
- Right column (Tip + Bookings + Contracts + Retainers + Onboarding + Deal Activity) currently sits below main column on mobile (good) but each widget needs its own pass.

**Pipeline (`PipelineView.tsx`)**
- Today: 5 stage columns shrink and wrap text. Switch to a horizontal scroll-snap row at <640px (`overflow-x-auto snap-x`), each card `min-w-[78%]`. Keeps it scannable instead of squashed.

**Sales Metrics (`SalesMetrics.tsx`)**
- Audit grid: ensure 2-col on mobile (not 1, not 4). Truncate currency when long, keep label one line.

**Coach Feed (`CoachFeedWidget.tsx`)**
- Action buttons currently can wrap. Make them stack full-width <480px and ensure refresh button stays in header.

**Priority Actions (`PriorityActions.tsx`)**
- Each action row: client name + reason + CTA must not collapse. Verify CTA stays right-aligned with proper truncation on the left.

**Activation Checklist (`ActivationChecklist.tsx`)**
- Already mobile-aware but the next-action row truncates labels too aggressively. Allow 2-line description on mobile.

**Sidebar widgets (Bookings / Contracts / Retainers / Onboarding)**
- Standardize padding, ensure CTAs are full-width on mobile, ensure timestamps don't push price off-screen.

**Tables across pages (`ProposalsDashboard`, `ContractsPage`, `RetainersPage`, `RecoveryDashboard`, `OnboardingDashboard`)**
- Where shadcn `Table` is used, wrap in `overflow-x-auto` and fix the first column as the readable label. Where rows are very wide (Recovery, Retainers), convert to a card list at <640px instead of a horizontally scrolled table.

**Forms (`NewProposal`, `NewClient`, `NewRetainerPage`)**
- Audit inputs at 360px: labels above inputs, full-width buttons, no two-column form fields below 640px.

**Misc**
- `index.css`: confirm no fixed `min-width` on body. Remove any stray `w-screen` causing horizontal scroll.

### Out of scope

- No design token changes
- No new components beyond a tiny `<MobileTable>` helper if needed (likely not — Tailwind classes are enough)
- No copy changes
- No analytics
- No tablet-specific pass (768px is fine today)

### Deliverable

A single focused pass. After this, opening the app at 390px feels like a deliberate mobile experience: no clipped buttons, no squashed pipeline columns, no horizontal page scroll, all CTAs reachable with one thumb.

### Technical notes

- Use existing Tailwind breakpoints only (`sm: 640`, `md: 768`, `lg: 1024`).
- Prefer `flex-col sm:flex-row`, `grid-cols-2 sm:grid-cols-4`, and `overflow-x-auto` patterns already used elsewhere.
- For tables → card lists, render two trees gated by `hidden sm:block` / `sm:hidden`. Acceptable given the small number of rows typical per user.
