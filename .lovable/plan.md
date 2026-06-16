# Smart Forms — Phase 3 (deferred items)

Three deferred pieces, scoped tight so each one ships cleanly.

## 1. File-upload field with signed uploads

Goal: let clients attach files (logos, contracts, copy docs) from any smart form — onboarding or public lead form.

- **Storage**: create private `form-uploads` bucket via the storage API. Owner-scoped RLS for it already shipped in Phase 2.
- **Edge function** `form-upload-sign` (`verify_jwt = false`, anon-callable):
  - Input: `{ token?: string, slug?: string, field_id: string, filename: string, content_type: string, size: number }`.
  - Resolves the form owner (`onboarding_forms.access_token` → `user_id`, or `lead_forms.slug` → `user_id` where `is_active`).
  - Rejects files > 20 MB or non-allowlisted MIME (image/*, application/pdf, text/*, common office types).
  - Generates `{user_id}/{form_kind}/{form_id}/{field_id}/{uuid}-{safe_filename}`, returns a signed upload URL via `storage.createSignedUploadUrl()` and a signed read URL (24 h) for the owner UI later.
  - Returns `{ path, upload_url, token, size_limit }`.
- **`SmartField` engine**: add `file` to `SmartFieldType` (`maxSizeMb?: number`, `accept?: string`). Treat the stored response value as a JSON-encoded `{ path, name, size, type }` object serialized to string for `Record<string,string>` compatibility.
- **`SmartFieldRenderer`**: render a file picker that calls `form-upload-sign`, uploads via the signed URL, then writes the resulting metadata into the response value. Show filename + size + "Remove".
- **`FieldListEditor`**: add `file` to the type picker; expose a `Max size (MB)` input and an `Accepted types` text input.
- **`LeadInbox` / onboarding response viewers**: when a response value parses as a file payload, render it as a downloadable chip (calls a small `form-upload-signed-read` edge function that returns a 5-min signed URL after verifying owner).
- **Out of scope**: image previews/thumbnails, multi-file fields, virus scanning.

## 2. Intake merge-tags in proposals / contracts / invoices

Goal: when a client has `intake_responses`, let the user drop `{{intake.<key>}}` placeholders into proposal, contract, or invoice templates and have them auto-fill on render.

- **Shared resolver** `src/lib/merge-tags.ts`:
  - `renderMergeTags(text: string, ctx: { client, intake, business }): string`.
  - Supported namespaces: `client.name|email|company|phone`, `business.name|owner_name`, `intake.<key>` (key = SmartField `id`).
  - Unknown tags are left in place (so unresolved merges stay visible, not blanked).
- **Apply at render time** in:
  - `ProposalView.tsx` (proposal body + intro/outro sections).
  - `ContractDetail.tsx` and `ContractSignPage.tsx` (contract body).
  - Retainer/invoice descriptions where free-text is shown to the client.
- **Editor affordance**: in proposal & contract template editors, add a small "Insert merge tag" popover listing available client/business tags plus, for client-bound editing, the `intake.*` keys derived from the active client's `intake_responses`. Clicking inserts the tag at cursor.
- **Backfill**: no schema changes — `intake_responses` already lives on `clients`. The lookup pulls the latest snapshot at render time.
- **Out of scope**: conditional template blocks (`{{#if intake.has_logo}}`), looping, math, formatting helpers.

## 3. "Pre-fill from intake responses" on onboarding creation

Goal: when creating an onboarding form for a client that has `intake_responses`, copy any matching field answers into the new form's `responses` so the client doesn't re-answer.

- **`CreateOnboardingFromTemplateDialog.tsx`**: when the selected client has non-empty `intake_responses`, show a switch "Pre-fill from lead intake (N answers)". Default ON. When ON, on submit, compute `prefill = intersection-by-field-id` between the template's fields and the client's `intake_responses`, and pass that to the `onboarding_forms` insert as the initial `responses`. Mark the form `status = 'in_progress'` and set `started_at = now()` if any prefill applied.
- **`ClientPortal.tsx`** (Send onboarding action, line ~316): same logic — pre-fill from `client.intake_responses` when present.
- **Matching rule**: exact `field.id` match first; fall back to slug-of-label match (`slug(label) === intake_key`) for templates whose field ids were generated from labels.
- **UI feedback**: after creation, toast "Onboarding sent — N answers pre-filled from lead form".
- **Out of scope**: smart cross-field inference (e.g. "Business name" from "Company"), partial-match dialogs.

## Files touched

**New:**
- `supabase/functions/form-upload-sign/index.ts`
- `supabase/functions/form-upload-signed-read/index.ts`
- `src/lib/merge-tags.ts`
- `src/components/forms/MergeTagPicker.tsx`

**Edited:**
- `src/lib/form-fields.ts` — add `file` type + helpers
- `src/components/forms/SmartFieldRenderer.tsx` — file field
- `src/components/forms/FieldListEditor.tsx` — file type config
- `src/pages/LeadInbox.tsx` — render file responses
- `src/pages/ProposalView.tsx`, `ContractDetail.tsx`, `ContractSignPage.tsx` — pipe through `renderMergeTags`
- `src/components/proposals/*EditorDialog`, `src/components/contracts/*EditorDialog` — merge-tag picker
- `src/components/templates/CreateOnboardingFromTemplateDialog.tsx` — prefill switch + logic
- `src/pages/ClientPortal.tsx` — prefill on send

## Order of execution

1. Section 3 (prefill) — smallest, immediate value, no new infra.
2. Section 2 (merge tags) — shared resolver + render-site updates + picker.
3. Section 1 (file uploads) — bucket + two edge functions + renderer/editor + inbox display.
