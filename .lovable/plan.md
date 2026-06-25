## Lead Assistant Settings + Auto-Send Foundation

Add a dedicated Lead Assistant settings panel and lay the groundwork for future auto-send — without enabling it.

### 1. Schema — extend `ai_preferences`
Add the missing Lead Assistant fields (most generic fields already exist):

- `business_name` text
- `booking_link` text
- `email_signature` text
- `lead_reply_style` text (default `"consultative"` — options: consultative, concise, warm, sales-forward)
- `lead_auto_send_enabled` boolean, default **false**
- `lead_auto_send_min_confidence` text, default `"high"` (low/medium/high)
- `lead_auto_send_only_new_leads` boolean, default `true`
- `lead_auto_send_block_keywords` text[] (default array of safety words: complaint, lawsuit, refund, chargeback, dispute, legal, attorney, etc.)

Reuse existing `business_services`, `lead_reply_tone`, `lead_reply_length` for Services / Tone / Default reply length.

### 2. New table — `lead_auto_send_log`
Records every auto-send attempt for future auditability.
Columns: `user_id`, `client_id`, `subject`, `body_preview`, `confidence`, `decision` (sent / blocked_keywords / blocked_low_confidence / blocked_existing_client / blocked_disabled), `reason`, `created_at`. Full RLS + service_role grants.

### 3. UI — `src/components/settings/LeadAssistantSettings.tsx`
New settings card with sections:

- **Business profile**: Business name, Services offered, Booking link
- **Voice & style**: Tone of voice, Default reply style, Default reply length
- **Signature**: multi-line textarea inserted at the bottom of generated replies
- **Auto-send (Coming soon)**: a clearly-labeled, disabled-by-default section with the toggle, min confidence selector, "only new leads" switch, and an editable block-keywords list. A persistent banner explains that auto-send is in preview and every message currently still requires manual review even if toggled on (the edge function will gate on a server-side feature flag until we ship full QA).

Mount under existing Settings page next to `AiPreferencesSettings`.

### 4. Edge function changes — `inbound-email-webhook`
- Load the user's `ai_preferences` row.
- Inject business name, services, tone, style, length, signature, and booking link into the AI system prompt so drafts reflect each user's voice.
- Append signature to the drafted reply body if set.
- Add (but do not activate) `evaluateAutoSend(prefs, classification, client)` helper that returns `{ allow, reason }`. Currently always returns `{ allow: false, reason: 'auto_send_disabled_global' }`. Log the decision to `lead_auto_send_log`. This gives us the audit trail and decision logic stub without ever auto-sending.

### 5. `send-lead-reply` edge function
- Append the signature once on send if not already present (so manual sends are consistent with drafted previews).
- No auto-send path is wired up; it remains user-initiated only.

### Out of scope (deferred until user re-enables)
- Actually dispatching auto-sent emails.
- Confidence scoring model changes.
- Per-channel (WhatsApp) auto-send.

### Technical notes
- Default `lead_auto_send_enabled = false` at the column level **and** a hard server-side kill switch in the webhook, so even a flipped toggle won't send until we remove the global gate in a future release.
- Keyword blocklist matched case-insensitively against subject + body.
- All new fields are nullable / have safe defaults so existing users aren't broken.
