## Why you see `no-reply@auth.lovable.cloud`

Your project has `notify.closesync.io` added as a sender domain, but two things are blocking branded auth emails:

1. **No custom auth email templates are set up yet** — so Supabase falls back to the default Lovable sender (`auth.lovable.cloud`).
2. **DNS for `notify.closesync.io` is still pending** — even once templates are in place, emails won't switch over until DNS verifies.

## Plan

### 1. Scaffold custom auth email templates
Create the `auth-email-hook` edge function and 6 branded React Email templates (signup confirm, magic link, password recovery, invite, email change, reauthentication) styled to match the CloseSync dark/premium look (white email background, accent button, logo if available).

### 2. Deploy the hook
Deploy `auth-email-hook` so Supabase routes auth emails through it. Until DNS verifies, default emails keep sending — no downtime.

### 3. You finish DNS verification
Open **Cloud → Emails → Manage Domains**, add the DNS records shown there at your registrar (Cloudflare/wherever closesync.io lives), and wait for verification (usually minutes, up to 72h).

### 4. Result
Once DNS is green, the signup confirmation will arrive from something like `ProposalCraft AI <no-reply@notify.closesync.io>` instead of `@auth.lovable.cloud`, with your branding.

## Notes
- No changes to your app code or signup flow — purely email infrastructure.
- The "ProposalCraft AI" sender name comes from the project name; we can also rename that if you'd like.
- Files added: `supabase/functions/auth-email-hook/` + `supabase/functions/_shared/email-templates/*.tsx`.
