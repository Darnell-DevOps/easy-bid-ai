## Goal
Surface the user's unique inbound lead email address prominently on the Lead Assistant page so they can forward enquiries straight in.

## Changes

**1. New component: `src/components/leads/InboundAddressCard.tsx`**
A compact, premium-styled card matching the Lead Assistant's existing aesthetic. It will:
- Fetch the current user's `user_inbound_aliases` row (`slug`, `inbound_secret`) — same query as `InboundEmailSettings`.
- Display the full address `leads-<slug>@leads.closesync.io` in a read-only input with a Copy button (toast on copy).
- Show a short helper line: "Forward any enquiry here — we'll create the lead and draft an AI reply."
- Include a small "Beta" badge and an icon (Inbox / Sparkles).
- Link to Settings → Integrations for advanced wiring (webhook URL, secret).
- Graceful loading skeleton and empty-state if no alias yet.

**2. `src/pages/LeadAssistant.tsx`**
Render `<InboundAddressCard />` near the top of the page (above the existing AI reply drafter card), so it's the first thing the user sees.

## Out of scope
- No DB/schema changes (table and RLS already exist).
- No changes to `InboundEmailSettings` in Settings.
- No changes to webhook / inbound parsing logic.
