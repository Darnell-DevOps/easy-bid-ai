# CloseSync — Codex Repository Instructions

## Repository map

- `src/pages/` — route-level React screens.
- `src/components/` — product components; shared shadcn/ui primitives live in `src/components/ui/`.
- `src/styles/closesync-design-system.css` — namespaced CloseSync design tokens and shared `cs-*` styles.
- `src/index.css` — Tailwind/shadcn theme compatibility layer and existing global styles.
- `src/lib/`, `src/hooks/`, `src/integrations/` — application logic, hooks, and service clients.
- `src/test/` — Vitest regression and source-contract tests.
- `tests/` — Playwright browser tests.
- `supabase/functions/` and `supabase/migrations/` — Edge Functions and database migrations.

## Design-system rule

CloseSync has a permanent visual design system.

Before creating, modifying, or restyling any user-interface code, read:

- `docs/DESIGN_SYSTEM.md`
- `src/styles/closesync-design-system.css`

These files are the source of truth for visual design.

## Core principles

- Consistency overrides novelty.
- Reuse existing components before creating new variants.
- Do not invent arbitrary colours, font sizes, weights, spacing values, radii, shadows, or component styles.
- Use the design tokens defined in `src/styles/closesync-design-system.css`.
- Preserve existing product functionality when changing visual design.
- Do not redesign unrelated areas when working on a focused task.
- Avoid the generic AI-generated SaaS aesthetic.
- Not every section should be placed inside a card.
- Prefer hierarchy through typography, whitespace, alignment, subtle borders, and restrained surfaces.
- Keep the interface predominantly neutral.
- Use CloseSync violet for the primary functional brand colour.
- Reserve the full blue → violet → magenta gradient for the logo, selected brand moments, and restrained AI-specific accents.
- Use Geist as the primary typeface.
- Use one consistent outline icon family throughout the product.
- Accessibility, responsive behaviour, keyboard focus, and readable contrast must be preserved.

## When implementing UI

1. Inspect the existing component before changing it.
2. Check the design-system documentation.
3. Reuse existing tokens/components.
4. Keep visual changes consistent with neighbouring pages.
5. Check desktop and mobile layouts.
6. Avoid one-off CSS values unless there is a genuine layout-specific reason.
7. If a new reusable visual pattern is necessary, add it to the design system rather than duplicating it locally.

## Framework compatibility

- Keep Tailwind and shadcn/ui semantic variables such as `--primary`, `--background`, and `--card` in `src/index.css`.
- CloseSync design tokens use the `--cs-*` prefix so they do not collide with those semantic theme variables.
- Prefer updating an existing primitive in `src/components/ui/` over adding a parallel component.
- Preserve dark/light theme behaviour, Radix interactions, focus states, and reduced-motion support.
- Geist is the application font; Caveat remains an intentional exception for handwritten signature rendering.

## Verification

- Run focused tests for the component being changed.
- Before handing off a UI change, run `npm run check:launch`.
- Run relevant Playwright coverage for navigation, responsive, or interaction changes.
- Review `git diff` and confirm unrelated files and behaviour were not changed.

## Source-of-truth priority

For visual decisions:

1. `docs/DESIGN_SYSTEM.md`
2. `src/styles/closesync-design-system.css`
3. Existing shared CloseSync components
4. Page-specific implementation

If an existing page conflicts with the design system, prefer the design system unless the user explicitly instructs otherwise.
