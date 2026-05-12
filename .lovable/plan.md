## Customisable Client Email Templates

Add a Templates tab inside the Emails section letting users edit the subject, body, CTA, sign-off, and sender display name for every client-facing email CloseSync sends on their behalf. System emails (welcome, password reset, billing) remain untouched.

### 1. Database

New table `email_templates`:
- `id`, `user_id`, `template_key` (enum-like text), `subject`, `body` (markdown/plain with `{{vars}}`), `cta_text`, `cta_url_var` (which variable to use for the CTA link), `sign_off`, `sender_display_name`, `is_active`, `updated_at`, `created_at`.
- Unique on `(user_id, template_key)`.
- RLS: owner-only CRUD.

New table `business_branding` (1 row per user) for shared brand fields used in templates:
- `business_name`, `logo_url`, `brand_color`, `default_sender_name`, `default_sign_off`, `reply_to_email`.
- RLS: owner-only.

Both tables fall back to hard-coded defaults when no row exists, so nothing breaks for existing users.

### 2. Template keys (client-facing only)

```
proposal_sent
contract_sent
contract_reminder
payment_request
payment_reminder
booking_confirmation
onboarding_welcome
onboarding_reminder
retainer_renewal
payment_failed_followup
client_followup
```

Each ships with a polished default (warm, professional, conversion-focused) defined in `src/lib/email-templates-defaults.ts` and mirrored in `supabase/functions/_shared/client-email-templates.ts` for edge functions.

### 3. UI — Settings → Emails → Templates tab

- Update `EmailsDashboard.tsx`: wrap content in `Tabs` with `Logs` (existing) and `Templates` (new).
- New `src/components/emails/TemplatesPanel.tsx`:
  - Left column: list of all 11 templates with status (custom / default).
  - Right column: editor with fields Subject, Sender display name, Body (textarea), CTA button text, Sign-off.
  - Variable chips beside the editor (click to insert at cursor) showing the variables relevant to that template.
  - Live Preview pane that renders the email with sample data (and the user's branding).
  - Save / Reset to default buttons.
- New `src/components/emails/BrandingCard.tsx` at the top of the tab for business name, logo URL, brand colour, sender name, sign-off, reply-to.

### 4. Per-send preview & edit

- New `src/components/emails/SendEmailDialog.tsx`: shared dialog used by proposal/contract/onboarding/payment/retainer flows. Loads the user's template for the given `template_key`, renders preview with real entity data, lets the user tweak subject/body before sending. "Send" calls the existing `send-email` edge function; "Copy" copies the rendered HTML to clipboard.
- Wire into the existing "Send proposal", "Send contract", "Send onboarding", "Payment reminder", "Retainer renewal" actions in their current entry points (one-line dialog open replacing the direct send).

### 5. Edge function changes

- New shared helper `supabase/functions/_shared/client-email-templates.ts`:
  - `renderClientTemplate(supabase, userId, key, vars)` → loads user template (or default), interpolates `{{var}}`, applies branding, returns `{ subject, html, fromName, replyTo }`.
- Update `send-email` edge function: when `body.templateKey` matches a client-facing key, route through `renderClientTemplate` instead of the system template registry. System keys (`welcome`, `password-reset`, `payment-confirmation` for platform billing, etc.) keep their current path untouched.
- All existing call sites (proposal-sent, contract-signature-reminder, booking-confirmation, retainer-notification, follow-up-reminder, payment-failed) keep working — defaults match current behaviour.

### 6. Logs

`email_send_log` already records template, recipient, subject, status, provider_id, error, timestamp. Templates panel does not change logging — the existing Logs tab is unchanged. Linked entity IDs go into the existing `meta` jsonb (`{proposal_id, contract_id, ...}`) when the dialog sends an email.

### 7. Future-proofing

- `email_templates.template_key` is text (not enum) so new keys can be added.
- `meta` jsonb on log + `is_active` flag on templates leave room for sequences, A/B variants, and AI rewriting later without schema changes.

### Files to create
- `supabase/migrations/<ts>_email_templates.sql`
- `src/lib/email-templates-defaults.ts`
- `src/components/emails/TemplatesPanel.tsx`
- `src/components/emails/BrandingCard.tsx`
- `src/components/emails/SendEmailDialog.tsx`
- `supabase/functions/_shared/client-email-templates.ts`

### Files to edit
- `src/pages/EmailsDashboard.tsx` (add Tabs)
- `supabase/functions/send-email/index.ts` (route client-facing keys through new renderer)
- Send entry points for proposal/contract/onboarding/payment/retainer to use `SendEmailDialog`

### Out of scope (per request)
- No changes to welcome / password-reset / verification / platform billing emails.
- No automated sequences, A/B tests, AI rewriting, or custom sender domains in this pass — schema leaves room for them.
