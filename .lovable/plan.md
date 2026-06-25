## Goal
Make the existing forwarding-based inbound-email pipeline smarter: classify each incoming message as **lead / needs review / ignored**, and dedupe against existing leads so the Lead Assistant inbox only fills with real enquiries.

## What already exists (reuse, do not rebuild)
- Per-user forwarding address `leads-<slug>@leads.closesync.io` via `user_inbound_aliases`.
- `inbound-email-webhook` parses sender/subject/body, runs AI qualification, inserts into `clients` with `lead_source='Email'`, `status='New'`, `original_lead_message`, `lead_inbound_subject`, `lead_inbound_from_email`, `unread_at`.
- Lead Assistant surfaces these via `LeadInbox` / `LeadAssistant` pages, plus the new `InboundAddressCard`.

## Gaps to fix
1. Every inbound email becomes a `New` lead — even auto-replies, newsletters, receipts, or random forwards.
2. If the same sender emails twice, two duplicate client rows are created instead of appending to the existing lead.
3. No place to see "ignored" / "needs review" messages, so the user can't audit false negatives.

## Changes

### 1. Database (one migration)
Add a lightweight inbound-message log so non-lead emails are kept for audit without polluting `clients`:

- `public.inbound_messages`
  - `user_id`, `alias_id`
  - `from_email`, `from_name`, `subject`, `body_text`, `received_at`
  - `classification` enum-like text: `lead` | `needs_review` | `ignored`
  - `classification_reason` text (short AI/heuristic explanation)
  - `client_id` nullable (set when it became / was merged into a lead)
  - `created_at`
- Standard `id`/`created_at`, RLS scoped to `user_id = auth.uid()` for SELECT only, plus the required GRANTs (authenticated SELECT, service_role ALL — no INSERT for users; webhook writes via service role).
- Index on `(user_id, received_at desc)` and `(user_id, classification)`.

### 2. `inbound-email-webhook` — classification + dedupe
Pipeline becomes:
```text
parse -> heuristic gate -> AI classify+qualify -> route
```

**Heuristic gate (cheap, runs first):**
- Skip AI and mark `ignored` when any of:
  - `From:` matches common no-reply patterns (`noreply@`, `no-reply@`, `mailer-daemon@`, `postmaster@`, `notifications@`, `bounce`, `donotreply`)
  - Headers / body contain `List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted: auto-`
  - Subject starts with `Out of Office`, `Auto-reply`, `Delivery Status Notification`, `Undeliverable`
  - Body < 20 chars after stripping quotes/signatures

**AI classify+qualify (single call, replaces today's `draft_lead_reply`):**
- Extend the existing tool schema with two new required fields:
  - `is_lead`: boolean
  - `lead_confidence`: `"high" | "medium" | "low"`
  - `not_lead_reason`: string (empty when `is_lead=true`)
- Map:
  - `is_lead=true` AND confidence ≥ medium → **lead**
  - `is_lead=true` AND confidence = low → **needs_review**
  - `is_lead=false` → **ignored**

**Dedupe before insert:**
- Look up existing `clients` row for this `user_id` where `email = from_email` (case-insensitive) AND `lead_source='Email'`.
- If found: append new message to a new column on `clients` — `lead_thread` (jsonb array of `{subject, body, received_at}`), bump `unread_at`, leave existing `status` alone, and skip creating a new client.
- Else (and classification = `lead`): create the client as today.
- For `needs_review` / `ignored`: do NOT touch `clients`. Always record into `inbound_messages` with the classification + reason.

Always insert a row into `inbound_messages` regardless of outcome, linking `client_id` when a lead row exists.

Add `lead_thread jsonb DEFAULT '[]'` column to `clients` in the same migration.

### 3. Lead Assistant UI — surface the new bucket
Small additions to `src/pages/LeadAssistant.tsx`:
- A new tab/section "Needs review" listing rows from `inbound_messages` where `classification='needs_review'` for the current user.
- Each row: From, subject, snippet, "Convert to lead" and "Ignore" buttons.
  - Convert calls a new SECURITY DEFINER RPC `inbound_message_promote(_id uuid)` that creates a `clients` row from the stored fields and updates the message's `client_id` + `classification='lead'`.
  - Ignore calls `inbound_message_ignore(_id uuid)` flipping classification to `ignored`.
- A collapsed "Ignored" disclosure below it for transparency (read-only list, last 20).

No changes to existing Lead Assistant reply-drafting flow.

## Out of scope (kept for later, per user)
- Gmail / Outlook OAuth.
- Outbound send via user's mailbox.
- Threading by `Message-ID` / `In-Reply-To` headers (current dedupe is by sender email only — good enough for v1, noted in code comments).

## Technical details
- Migration includes table create + GRANTs + RLS + policies + `clients.lead_thread` column + two RPCs (`inbound_message_promote`, `inbound_message_ignore`) as SECURITY DEFINER scoping to `auth.uid()`.
- `inbound-email-webhook` stays public (`verify_jwt = false`) and continues to use the service-role client for all writes.
- AI call stays a single Gemini tool-call — just adds the three classification fields, so token cost is unchanged.
- No frontend route changes; only `LeadAssistant.tsx` gains the new sections.
