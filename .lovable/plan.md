# Smart Forms — Phase 2

Phase 1 shipped the lead-capture system (builder, public form, inbox, AI generator) and a shared field engine. Phase 2 finishes the deferred work: upgrading the existing onboarding system to use the same engine, adding file uploads, and wiring lead responses into the rest of CloseSync.

## 1. Upgrade onboarding to the shared field engine

- `src/pages/OnboardingFormPage.tsx`: replace the bespoke field renderer with `SmartFieldRenderer`. Keep section grouping, per-section progress, autosave.
- `src/components/OnboardingTemplateEditorDialog.tsx`: replace the field list UI with `FieldListEditor`, add:
  - field-type picker (all 11 SmartField types)
  - options editor (select/radio/multi-select/checkbox)
  - conditional rule builder (single rule, equals/contains/empty)
  - help text + required toggle
  - "✨ Generate with AI" button → `AiGenerateFieldsDialog` calling `ai-generate-form` with `context: "onboarding"`
- Section grouping: add a `section` string on each field; render grouped with a sticky section progress bar.

## 2. Reusable onboarding templates

- `onboarding_templates` table already exists. Add to the editor:
  - "Save as template" (snapshot current fields into `onboarding_templates`)
  - "Load from template" picker (replaces or appends fields)
- No schema change required beyond confirming columns; if missing, add `fields jsonb` + name/description.

## 3. File uploads in forms

- New Storage bucket `form-uploads` (private).
- Edge function `form-upload-url`: returns a signed upload URL scoped to `{user_id}/{form_or_template_id}/{uuid}-{filename}`. Used by both onboarding and public lead forms.
- `SmartFieldRenderer`: implement the `file` type — upload via signed URL, store the resulting object path in the response value.
- RLS on `storage.objects` for `form-uploads`: owner can read/write; public lead submissions write via the edge function (service role) only.

## 4. Lead → Client → downstream wiring

- `lead_convert_to_client` (already created): extend to copy `leads.responses` into a new `clients.intake_responses jsonb` column (migration).
- When the user creates a proposal / contract / invoice / onboarding form for a client that has `intake_responses`:
  - Proposal & contract template merge fields: expose `{{intake.<field_key>}}` placeholders resolved from `intake_responses`.
  - Onboarding form creation dialog: "Pre-fill from intake responses" toggle that copies matching `field.key` values into the new form's initial answers.
- Lead detail drawer in `LeadInbox.tsx`: show all responses in a readable list (label → value), plus a "View as client" link after conversion.

## 5. Polish

- Add empty/loading/error states to `LeadFormsDashboard`, `LeadFormEditor`, `LeadInbox`, `PublicLeadFormPage`.
- Public form: honor `brand` (accent color, logo URL) on the page chrome.
- Embed mode (`?embed=1`): strip outer chrome, transparent background, post `{type:"lovable-form-submitted"}` to `window.parent`.
- Add "Copy link" + "Copy embed snippet" buttons in `LeadFormEditor`.

## Out of scope (still)

- Lead scoring / auto-qualification (separate roadmap item #2).
- Multi-rule conditional logic (AND/OR trees).
- Drag-and-drop field reordering (use up/down buttons for now).
- Analytics beyond view + submit counts.

## Technical notes

- Migration: `ALTER TABLE clients ADD COLUMN intake_responses jsonb DEFAULT '{}'::jsonb;` plus `onboarding_templates.fields jsonb` if missing.
- Storage: `form-uploads` bucket, RLS on `storage.objects`, edge function signs uploads.
- Reuse `src/lib/form-fields.ts` everywhere — no parallel field schemas.
- `OnboardingField` already aliases `SmartField`, so the renderer swap is type-safe.
