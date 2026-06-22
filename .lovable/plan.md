
## Goal

Make the client portal feel as alive and premium as the landing-page `ClientPortalShowcase` mock (the screenshot you attached). Same dark glassmorphic language, ambient gradient orbs, animated stage tracker, "Live" pulse, and a live activity ticker — applied to the real `/portal/:id` page.

## Scope

Visual / presentation only. No changes to data model, RPCs, business logic, or routes. Everything stays driven by the same `proposal`, `contract`, `onboarding`, `bookings` state already loaded in `ClientPortal.tsx`.

## What changes

### 1. `src/pages/ClientPortal.tsx` — page shell
- Replace the flat `bg-background` shell with a layered backdrop: dark gradient base + two animated soft-pulse blurred orbs (accent + purple), matching `ClientPortalShowcase`.
- Replace the plain sticky header with a "browser window chrome" header: traffic-light dots, faux URL (`portal.closesync.io / {company-slug} / {project-slug}`), and a green pulsing **Live** indicator on the right. Keep `StatusBadge` accessible just below or merged in.
- Wrap main content in a glass card (`border border-border/60 bg-card/70 backdrop-blur-xl shadow-[0_30px_80px_-20px_hsl(var(--accent)/0.25)]`) so the whole portal sits inside the same "portal mock" frame the landing page uses.

### 2. `src/components/portal/ProjectOverview.tsx` — welcome + next action
- Welcome header: add subtle gradient text on the project name, a progress % readout on the right (derived from current stage index / total stages), and a thin animated gradient progress bar underneath (accent → purple → accent with soft glow), mirroring the landing mock.
- Next Action card: keep current content but upgrade the icon tile to a gradient pill with an accent ring/glow when actionable; add a faint animated ping on the icon when an action is required.
- Side rail: keep upcoming booking + deadline; add a third small "Live activity" tile that mirrors the landing page's three-row pulse list (most recent activity events with colored pulse dots).
- Recent Activity: restyle rows with connector line between status dots (like the landing tracker), and add a subtle hover lift.

### 3. `src/components/portal/ProjectProgressTracker.tsx` — stage tracker
- Rebuild visually to match the landing mock's vertical stage list style adapted for the portal:
  - Each stage in its own rounded card (`border-border/50 bg-background/30`).
  - Active stage: accent-tinted bg, glowing ring, spinning `Loader2`, animated `ping` halo.
  - Complete stages: emerald gradient icon tile with `Check`.
  - Pending stages: muted, lower opacity.
  - Vertical connector line between stages tinted to the progress.
  - Right-side status pill: COMPLETE / IN PROGRESS / PENDING with matching colors.
- Keep the same `ProjectStage` API so the page doesn't need rewiring.

### 4. Tokens / utilities
- Reuse existing tokens (`--accent`, `--purple`, `--card`, `--border`, `--foreground`, `--muted-foreground`) and existing animations (`animate-pulse`, `animate-ping`, `animate-soft-pulse`, `animate-scale-in`). No new global CSS needed; the landing page already defines `soft-pulse` keyframes via Tailwind config.
- No hardcoded colors — all surfaces go through semantic tokens so light mode still works.

## Out of scope

- No changes to `ClientPortalShowcase` (landing) itself.
- No changes to onboarding form page, contract sign page, or proposal/pricing renderers embedded inside the portal.
- No new data fetches; "Live" indicator is purely visual.

## Files touched

- `src/pages/ClientPortal.tsx` — shell, header chrome, ambient background, glass frame
- `src/components/portal/ProjectOverview.tsx` — welcome, progress bar, next-action polish, live activity tile
- `src/components/portal/ProjectProgressTracker.tsx` — stage list redesign
