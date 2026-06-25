
## Goal
Build on what already exists. The inbound email webhook already drafts a reply via AI and stores `lead_draft_reply` / `lead_draft_subject` on the client. We'll surface that draft on the lead detail page with a review-first action panel, plus an in-app notification so users know when a new AI draft is waiting.

## What already exists (not rebuilding)
- AI extraction of score, missing info, recommended action, draft reply, subject (in `inbound-email-webhook`).
- `clients.lead_draft_reply`, `lead_draft_subject`, `lead_score`, `missing_info`, `ai_recommendation`, `original_lead_message`, `lead_quality`.
- Lead Summary card on `ClientDetail` showing original message, score, missing info, recommendation.
- `user_notifications` table + bell UI.

## Additions

### 1. In-app notification when a new AI draft lands (1 file)
- In `supabase/functions/inbound-email-webhook/index.ts`, after a lead row is inserted with a draft, insert a `user_notifications` row:
  - `category: "lead"`, `key: "ai_reply_ready"`, title `"New AI reply ready for {name}"`, body = first ~140 chars of message, `link_url: /dashboard/clients/{id}#ai-reply`, metadata `{ client_id, lead_score }`.
- Deduped per client_id via the existing `key` unique pattern (or include client id in `key`).

### 2. Schema additions (one migration)
Add to `public.clients`:
- `lead_reply_sent_at timestamptz` — set when user sends the reply.
- `lead_reply_edited boolean default false` — toggled when user edits before sending.
- `not_a_lead boolean default false` — for "Mark as Not a Lead".

No RLS changes; existing client RLS already covers these columns.

### 3. Edge function: `send-lead-reply` (new)
- Auth: user JWT, finds client by id (owned by `auth.uid()`).
- Body: `{ client_id, subject, body }`.
- Sends via the existing `send-transactional-email` flow using a new template `lead-reply` (plain branded email containing the body) to `clients.email`.
- On success: updates `clients.lead_reply_sent_at = now()`, sets `status='Contacted'` if currently `'New'`.
- Returns `{ ok: true }`.

### 4. Lead detail UI — new "AI Suggested Reply" block on `ClientDetail.tsx`
Rendered inside the existing Lead Summary card (or directly below it) only when `lead_draft_reply` exists. Anchor id `ai-reply` so the notification deep-links to it.

Layout:
```text
┌─ AI Suggested Reply ──────────────────────┐
│ Subject: [____editable input____]         │
│ ┌───────────────────────────────────────┐ │
│ │ editable textarea (draft body)        │ │
│ └───────────────────────────────────────┘ │
│ Missing info chips · Next action pill     │
│ [Send Reply] [Copy] [Edit] (toggles RO)   │
│ [Send Intake Form] [Create Proposal]      │
│ [Mark as Not a Lead]                      │
│ "Sent {time ago}" once lead_reply_sent_at │
└───────────────────────────────────────────┘
```
Behaviour:
- **Edit Reply**: toggles the textarea between read-only preview and editable; saves debounced to `clients.lead_draft_reply` (and sets `lead_reply_edited=true`).
- **Send Reply**: calls `send-lead-reply`. Confirms in toast. Hides Send button once `lead_reply_sent_at` set; replaces with "Sent {when} · Resend".
- **Copy**: writes subject + body to clipboard.
- **Send Intake Form**: navigates to existing intake form flow with `client_id` prefilled (use existing `/dashboard/onboarding/new?client_id=`).
- **Create Proposal**: navigates to `/dashboard/new` with the same prefill used today by the AI Lead Assistant (`prefillFromClient`).
- **Mark as Not a Lead**: sets `not_a_lead=true`, `status='Archived'`, clears notification; toast + collapses the block.

### 5. Notifications bell tweak (optional, tiny)
- Ensure bell badge picks up `category='lead'`; if existing filter excludes new categories, include it.

## Out of scope
- No auto-send (explicitly required).
- No changes to manual AI Lead Assistant page flow (it already shows the draft and conversion buttons).
- No new AI model call from the lead detail page — we reuse the draft already produced by the webhook. Regenerating draft can come later.

## Technical notes
- Email template `lead-reply` is a minimal React Email component using the brand styles already in `_shared/transactional-email-templates`. Subject from input, body wrapped in branded container, includes signature footer if `business_branding` has one.
- `send-lead-reply` validates inputs with zod; idempotency key = `lead-reply-{client_id}-{sent_count}`.
- All new clients query columns added via a single migration with GRANTs already in place on `clients`.
