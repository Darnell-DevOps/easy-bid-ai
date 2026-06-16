# Smart Forms — Build Plan

Two coordinated upgrades, sharing one field-engine and one editor pattern:

**A. Smart Onboarding Forms** (extend what exists)
**B. Lead-Capture Form Builder** (new public surface that creates leads)

Both reuse the same field types, conditional-logic engine, editor UI, and AI generator.

---

## A. Smart Onboarding Forms

Extend the existing `onboarding_forms` / `onboarding_templates` system without breaking current forms.

### A1. Extend the field schema (`src/lib/onboarding.ts`)

Add to `OnboardingField`:
- `condition?: { fieldId: string; operator: "equals" | "not_equals" | "is_empty" | "is_not_empty" | "contains"; value?: string }` — single-rule conditional visibility (covers 95% of needs without complexity).
- New `type` values: `select`, `multi_select`, `radio`, `checkbox`, `date`, `number`, `file`.
- `options?: string[]` for select/radio.
- `helpText?: string`.

Add helper `isFieldVisible(field, responses)` and update `onboardingProgress()` to ignore hidden fields when computing required completion.

### A2. Renderer (`src/pages/OnboardingFormPage.tsx`)

- Render new field types (select via shadcn `Select`, radio via `RadioGroup`, checkbox via `Checkbox`, date via `Input type="date"`, file via storage upload).
- Wrap each field with `isFieldVisible` check; hidden fields are skipped from validation and progress.
- Keep section grouping (already exists via `groupFields`) and the sticky save/submit bar.
- Per-section progress indicator (small ring next to each `## Section` heading).

### A3. File uploads

- New Storage bucket `onboarding-uploads` (private).
- RLS on `storage.objects`: clients without auth can `INSERT` via signed-URL flow scoped to their form's `access_token` (use an edge function `onboarding-upload-url` that validates the token then issues a signed upload URL into `{form_id}/{field_id}/{filename}`).
- Owners can read all objects under their `{user_id}/...` prefix.
- Field response stores the object path; renderer shows filename + remove button.

### A4. Template editor (`OnboardingTemplateEditorDialog.tsx`)

Add to each field row:
- Type picker covering all new types.
- Options editor (chips) for select/radio/multi_select.
- Conditional rule builder: "Show this field when [field ▾] [operator ▾] [value]".
- Help-text input.

Add two top-level buttons in the editor:
- **"✨ Generate with AI"** — prompt input, calls new edge function `ai-generate-form`, returns a field list to merge or replace.
- **"Save as template"** / **"Load from template"** — already partially exists; ensure new field types serialize.

### A5. AI form generation (`supabase/functions/ai-generate-form/index.ts`)

- Input: `{ prompt: string, context?: "onboarding" | "lead" }`.
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with a system prompt that defines the `OnboardingField` JSON shape and constraints.
- Returns `{ fields: OnboardingField[] }` validated against a Zod schema.
- Reused by both onboarding editor and lead-form editor.

---

## B. Lead-Capture Form Builder

New feature: build forms, share via public link or embed, submissions become leads.

### B1. Data model (one migration)

```text
lead_forms
  id, user_id, name, slug (unique), title, description,
  fields jsonb,              -- OnboardingField[] (same shape)
  redirect_url, submit_label,
  brand jsonb,               -- {primary_color, logo_url} optional
  is_active, created_at, updated_at

leads
  id, user_id, form_id (nullable, FK lead_forms),
  name, email, phone, company,
  responses jsonb,           -- full answer map
  source text,               -- 'form' | 'manual' | 'import'
  status text default 'new', -- 'new' | 'qualified' | 'converted' | 'archived'
  client_id uuid nullable,   -- set when promoted to client
  created_at, updated_at

lead_form_views
  id, form_id, viewed_at, ip_hash, user_agent
```

GRANTs + RLS:
- `lead_forms`: owner full access; public `SELECT` only when `is_active = true` (needed for the public form page). Anon read allowed for active forms.
- `leads`: owner full access only; anon insert blocked.
- Public submission goes through a SECURITY DEFINER RPC `lead_form_submit(slug, responses jsonb)` that inserts into `leads` server-side. (Mirrors the existing `onboarding_submit` token-gated pattern listed in core memory.)
- `lead_form_views` insert via SECURITY DEFINER RPC `lead_form_record_view(slug)`.

### B2. Builder UI (`src/pages/LeadFormsDashboard.tsx`, `src/pages/LeadFormEditor.tsx`)

- List page: cards for each form (name, submission count, conversion rate, share link, toggle active).
- Editor: reuses the field editor component built in A4 (same `OnboardingField` shape + conditional logic + AI generate).
- Header settings: title, description, redirect URL, submit button label, brand color.
- Right-side live preview pane.
- Share panel: copy public link, copy `<iframe>` embed code, copy `<script>` snippet.

### B3. Public form page (`src/pages/PublicLeadFormPage.tsx`, route `/f/:slug`)

- No auth. Fetches form by slug via the anon-allowed `lead_forms` row.
- Renders fields with the same shared renderer as onboarding (conditional logic, all types).
- On submit calls `lead_form_submit` RPC.
- Success state with optional redirect.
- Embed-friendly: minimal layout, supports `?embed=1` query for chromeless rendering.
- Calls `lead_form_record_view` once on mount.

### B4. Leads inbox (`src/pages/LeadsDashboard.tsx`, route `/dashboard/leads`)

- Table of leads (name, email, source form, status, created).
- Row drawer: full responses, "Convert to client" button (creates a `clients` row, copies responses into client notes/metadata, sets `leads.client_id` + `status='converted'`), "Archive" button.
- Filters by form, status, date.
- Empty state links to "Create your first lead form".

### B5. Responses attach to downstream entities

When a lead is converted to a client:
- Copy `leads.responses` into the new client's metadata so `NewProposal`, contract, invoice, and onboarding generators can pre-fill from it.
- Onboarding `OnboardingTemplatesGallery` / `CreateOnboardingFromTemplateDialog`: when creating a form for a converted-from-lead client, pre-populate matching response fields by name match.

### B6. Nav (`src/components/DashboardLayout.tsx`)

Under the "Sales" group, add:
- **Leads** → `/dashboard/leads`
- **Lead Forms** → `/dashboard/lead-forms`

---

## Technical notes

- **Shared field engine** lives in `src/lib/form-fields.ts` (extracted from `onboarding.ts`): types, `isFieldVisible`, `validate`, `computeProgress`. Both onboarding and lead forms import from it.
- **Shared renderer component** `src/components/forms/SmartFieldRenderer.tsx` used by `OnboardingFormPage`, `PublicLeadFormPage`, and the builder's live preview.
- **Shared editor component** `src/components/forms/FieldListEditor.tsx` used by both onboarding template editor and lead form editor.
- **AI function** `ai-generate-form` is reused by both editors with a `context` flag that adjusts the system prompt (intake-style vs onboarding-style).
- All new routes wrapped in `AuthGuard` except `/f/:slug`.
- Maintain the premium dark theme; no visual redesign of existing surfaces.

## Out of scope (explicitly not in this round)

- Multi-rule / boolean-tree conditional logic (single rule per field is enough).
- Drag-and-drop field reordering (use ↑/↓ buttons like the current editor).
- Lead scoring (that's evaluation item #2 — separate request).
- Embed analytics dashboard beyond view + submission counts.

## Files to create

- `src/lib/form-fields.ts`
- `src/components/forms/SmartFieldRenderer.tsx`
- `src/components/forms/FieldListEditor.tsx`
- `src/components/forms/ConditionalRuleEditor.tsx`
- `src/components/forms/AiGenerateFieldsDialog.tsx`
- `src/pages/LeadFormsDashboard.tsx`
- `src/pages/LeadFormEditor.tsx`
- `src/pages/PublicLeadFormPage.tsx`
- `src/pages/LeadsDashboard.tsx`
- `supabase/functions/ai-generate-form/index.ts`

## Files to edit

- `src/lib/onboarding.ts` (extend types, delegate to form-fields)
- `src/pages/OnboardingFormPage.tsx` (use SmartFieldRenderer, conditional logic)
- `src/components/templates/OnboardingTemplateEditorDialog.tsx` (use FieldListEditor)
- `src/App.tsx` (routes)
- `src/components/DashboardLayout.tsx` (nav entries)

## Migrations

1. `lead_forms`, `leads`, `lead_form_views` tables + GRANTs + RLS + `lead_form_submit` + `lead_form_record_view` SECURITY DEFINER RPCs.
2. Storage bucket `onboarding-uploads` + RLS + `onboarding-upload-url` edge function (created alongside, no migration needed for the function).
