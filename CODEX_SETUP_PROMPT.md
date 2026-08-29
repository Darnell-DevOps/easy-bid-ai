# One-time Codex setup prompt

Add the CloseSync design-system files in this repository as permanent project guidance.

Use:
- `AGENTS.md` as the concise repository instruction/map.
- `docs/DESIGN_SYSTEM.md` as the human-readable source of truth for branding and UI decisions.
- `src/styles/closesync-design-system.css` as the design-token and shared-style implementation.

Then:

1. Inspect the existing project structure and current global stylesheet.
2. Integrate `src/styles/closesync-design-system.css` into the application's global styling without breaking the existing framework, Tailwind, shadcn/ui, or current functionality.
3. Ensure Geist is the primary application font, with the documented fallback stack. Use the project's existing font-loading approach where possible.
4. Where the application already has reusable components, adapt them to use the design tokens rather than replacing them unnecessarily.
5. Do not redesign the entire application in one uncontrolled pass.
6. Preserve all current functionality.
7. From this point onward, treat `docs/DESIGN_SYSTEM.md` and the stylesheet tokens as the source of truth for all UI changes.
8. If existing one-off styles conflict with the design system, gradually normalise them when those components are touched.
9. Avoid introducing new arbitrary colours, spacing, radii, shadows, and typography values.
10. Before finishing, report:
   - which files were changed,
   - how the design system was integrated,
   - any conflicts found,
   - any follow-up migrations you recommend.

Do not remove existing working UI behaviour merely to achieve visual consistency.
