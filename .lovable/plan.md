## Goal

Make the public lead form feel premium and conversion-focused, with the smart field set you described, while keeping the form fully editable per user.

## What already exists

- `PublicLeadFormPage.tsx` already renders fields grouped by section, with conditional logic, file upload, dropdowns — the engine in `src/lib/form-fields.ts` supports everything you need.
- The `lead_form_submit` RPC already creates a `leads` row with `status = 'new'`, saves the full JSON `responses` (consumed by proposal generation today), and writes a `user_notifications` activity entry ("New lead from …"). No backend changes required.

## Changes

### 1. Public form visual upgrade — `src/pages/PublicLeadFormPage.tsx`

- Wrap the form in a premium card: subtle gradient border, soft inner shadow, generous `space-y-8` between sections; tighten field spacing to `space-y-5` inside.
- Section headers: small uppercase eyebrow ("Contact", "Project Details", "Budget & Timeline", "Additional Information") + a thin divider, instead of the current single purple label.
- Field polish: refine labels, helper text styling, and focus rings (accent ring, smooth transition). Required asterisk in `text-rose-500`.
- Trust line above the submit button:
  "Submit your details and we'll prepare the next step for your project."
- Submit button:
  - Label override: when a form still has the default `submit_label` (`"Submit"` or empty), render "Send Project Details".
  - Soft gradient (`from-accent via-purple to-accent`) with shadow and hover brightness, full-width on mobile.
- Success screen redesign:
  - Centered card, accent gradient halo behind the check icon.
  - Title: "Project details received"
  - Body: "We've received your details and will review your project shortly."
  - Primary button "Back to homepage" → routes to `/`.
  - Keeps the existing redirect-URL override behavior when the form owner has configured one.

### 2. Smart default fields for new forms — `src/pages/LeadFormsDashboard.tsx`

When the user clicks "New lead form", insert this field set (instead of the current 3 placeholders). Existing forms are untouched — owners can keep editing in the builder.

```text
Contact
  - Your name *          short_text
  - Email *              email
  - Phone / WhatsApp     phone
  - Company name         short_text

Project Details
  - Service interested in *   select: Website Design, Branding,
                              Social Media Management, Marketing Strategy,
                              Automation, Consulting, Other
  - What can we help you with? *   long_text
  - Main goal             short_text  (placeholder: "More leads, better branding,
                                        faster workflow, more sales…")

Budget & Timeline
  - Estimated budget *    select: Under £500, £500–£1,000, £1,000–£2,500,
                                  £2,500–£5,000, £5,000+, Not sure yet
  - Desired timeline *    select: ASAP, Within 1 week, 2–4 weeks,
                                  1–3 months, Flexible

Additional Information
  - Current website / social URL   url
  - Upload file or brief           file
  - Anything else?                 long_text

Conditional fields (auto-shown by service)
  - Website Design  → "Do you need copy/content?"   select: Yes / No / Not sure
  - Branding        → "Do you already have a logo?" select: Yes / No / In progress
  - Social Media    → "Which platforms do you use?" multi_select:
                       Instagram, TikTok, Facebook, LinkedIn, X, YouTube, Other
  - Automation      → "What process do you want automated?" long_text
```

The "Current website URL" stays in Additional Information so it's always available; the Website-Design-specific copy/content question is the conditional one.

Defaults also set `title: "Tell us about your project"`, `description: "A few quick details so we can prepare a tailored next step within one business day."`, and `submit_label: "Send Project Details"`.

### 3. No backend / schema changes

- `leads.status = 'new'`, responses JSON, and the activity notification are already produced by the existing RPC.
- Leads remain leads — they're surfaced in your Lead Inbox and can be converted to a client when you generate a proposal (existing flow). The form does not silently create a `clients` row from anonymous submissions.

## Files touched

- `src/pages/PublicLeadFormPage.tsx` — visual redesign + success screen + submit-label override + trust line.
- `src/pages/LeadFormsDashboard.tsx` — new default field set for "New lead form".

No new packages, no migrations, no edits to the form builder (existing customization still works).
