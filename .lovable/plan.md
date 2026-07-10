## Plan: Trim two landing-page sections

### What will change
1. **Remove the "See it work in 60 seconds" live demo**
   - Delete `src/components/landing/LiveDemo.tsx`.
   - Remove the `import LiveDemo` and `<LiveDemo />` usage in `src/pages/Index.tsx`.
   - Remove the "Demo" anchor in the landing nav (`<a href="#live-demo">`).
   - Replace the hero "See 60-second demo" outline button with a still-relevant secondary CTA (e.g. "Explore the platform" linking to `#platform`) so no broken anchor remains.

2. **Remove the "Stop paying for 7 tools" consolidation section**
   - Delete the entire `{/* ============ Consolidation ============ */}` section from `src/pages/Index.tsx` (lines 575–650).
   - Remove the now-unused `replacedTools` data constant and `XCircle` import.

3. **Verify no broken references**
   - Confirm no other file imports `LiveDemo`, links to `#live-demo`, or references `replacedTools`.
   - Run a type check and view the landing page to ensure layout and remaining CTAs are intact.

### What will NOT change
- All other landing sections (Hero, Platform grid, Journey, AI Assistant, Retainers, Client Portal, Social proof, Pricing, Footer).
- Existing analytics `track()` calls for CTAs that remain.
- No backend or route changes.

### Acceptance criteria
- Landing page no longer contains the heading "See it work in 60 seconds".
- Landing page no longer contains the heading "Stop paying for 7 tools. Use one.".
- No broken `#live-demo` links in nav or hero.
- Build passes.