## Goal
Shrink the "Everything you need to run client work" platform grid so it stops dominating the page, while keeping every workflow visible — as an animation instead of a static 14-cell wall.

## Current state
`src/pages/Index.tsx` (lines ~510-560) renders a heading + a 3-column CSS grid of 13 workflow cards plus a CTA cell. On desktop this is ~5 tall rows of large tiles; on mobile it stacks into ~14 full-width cards. That's the height the user wants to reclaim.

## Proposed change (frontend only)
Replace the static grid with a compact animated **workflow reel**:

1. **Keep** the heading block, MonoTag ("Platform / 13 workflows"), and the right-side descriptive paragraph — but tighten spacing (`py-24` → `py-16`, `mb-14` → `mb-8`).
2. **Replace** the `.grid sm:grid-cols-2 lg:grid-cols-3 ...` block with a new `PlatformReel` component rendered inline in `Index.tsx`:
   - A single fixed-height panel (~`h-64` desktop / `h-72` mobile) with a subtle bordered frame matching current card styling.
   - **Left side (desktop) / top (mobile):** a vertical list of the 13 workflow titles as clickable/hoverable chips. The active one is highlighted (accent color + left border). Auto-advances every ~3s; pauses on hover; arrow-key + click navigation for a11y.
   - **Right side:** the active workflow's icon (large), title, and description, cross-fading in with `animate-fade-in` / a small `translateY`. Number badge ("07 / 13") for context.
   - Progress bar underneath the reel that fills over the 3s dwell to signal auto-advance.
3. **Continuous marquee variant for mobile:** if the split panel feels heavy on narrow screens, fall back to a single horizontally scrolling row of pill-sized workflow cards (icon + title) using the existing `.lp-marquee-track` primitive from `index.css`, pausing on touch. Decision: use the split panel at `md+` and the marquee at `< md`.
4. **Preserve the CTA** ("Try every workflow free" → `/signup`) as a single accent button under the reel instead of a filler grid cell — same `track("cta_click", { location: "platform_grid" })` call so analytics stay intact.
5. Keep the `platform` data array untouched — the reel reads from it, so all 13 items remain in the DOM and are still crawlable for SEO.

## Files touched
- `src/pages/Index.tsx` — swap the grid JSX for the reel, tighten section padding, keep heading + CTA analytics.
- (Optional) new `src/components/landing/PlatformReel.tsx` if the reel logic grows beyond ~40 lines, to keep `Index.tsx` readable. Uses `useState` + `useEffect` interval, `useReducedMotion` respect via existing `@media (prefers-reduced-motion)` rule (auto-advance disabled → user clicks chips).

## Out of scope
- No copy changes to workflow titles/descriptions.
- No changes to any other landing section, tokens, or the `platform` data source.
- No new dependencies (pure React + Tailwind + existing keyframes).

## Verification
Build passes; visually confirm on desktop and mobile viewports that (a) the section is noticeably shorter, (b) all 13 workflows cycle through, (c) hover pauses auto-advance, (d) reduced-motion users see a static first item and can navigate manually.