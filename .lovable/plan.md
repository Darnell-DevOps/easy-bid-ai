## Goal

Make the new-form defaults and the editor's live preview match the premium public lead form (`PublicLeadFormPage`), so users see — and ship — the same experience visitors get. Don't touch existing forms.

## 1. Default form content (LeadFormsDashboard.tsx `create()`)

Field list is already aligned. Update the seed metadata to match the public-form voice/CTA:

- `title`: keep "Tell us about your project"
- `description`: tighten to one premium-sounding line
- `submit_label`: already "Send Project Details" — keep
- `success_message`: replace generic text with the public page's "Project details received. We've received your details and will review your project shortly."

## 2. Editor live preview (LeadFormEditor.tsx, right column)

Restyle ONLY the right-hand preview panel to mirror `PublicLeadFormPage` chrome. No changes to the editor's left column or save logic.

What changes inside the existing sticky preview container:

- Wrap content in a rounded-2xl card with `border-border/60 bg-card/70 backdrop-blur`, soft top gradient line, and a blurred purple/accent radial glow — same as public page.
- Header: larger tracking-tight title + muted description.
- Section groups: numbered chip (1, 2, 3…) + uppercase tracking label + divider line, identical markup to the public page.
- Fields: same `Label` styling, same focus-ring wrapper around `SmartFieldRenderer`, same helpText style.
- Footer: top border, centered shield + trust line ("Submit your details and we'll prepare the next step for your project."), and a full-width gradient submit button (`from-accent via-purple to-accent`) showing the form's `submit_label` (fallback "Send Project Details"). Button stays `disabled` — preview only.
- Keep the existing "Live preview" caption and `max-h-[80vh] overflow-y-auto` scroll behavior so the preview still fits the editor layout.

No new dependencies. Reuses existing tokens (`accent`, `purple`, `border`, `card`, `foreground`, `muted-foreground`) — no hardcoded colors.

## 3. Out of scope

- Existing lead forms are not migrated or modified.
- No backend/RPC changes.
- No changes to `PublicLeadFormPage`, `SmartFieldRenderer`, or the editor's left-column field editor.

## Files touched

- `src/pages/LeadFormsDashboard.tsx` — update seed `description` and `success_message` in `create()`.
- `src/pages/LeadFormEditor.tsx` — replace the live-preview block (inside the existing `lg:col-span-2` sticky container) with the premium layout described above.
