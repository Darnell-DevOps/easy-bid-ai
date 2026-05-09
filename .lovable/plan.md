## Goal
Send all emails (auth + app) from `notify@closesync.io` using Resend.

## Why this works
You're using the **root domain** `closesync.io` as the sender — NOT the `notify.closesync.io` subdomain that's still delegated to Lovable's nameservers. So you can ignore the NS record cleanup for now and verify Resend immediately on the root domain.

(`notify@closesync.io` = mailbox `notify` at domain `closesync.io`. Different from the `notify.closesync.io` subdomain.)

---

## Step 1 — Verify `closesync.io` in Resend (you do this)

1. Go to https://resend.com/domains → **Add Domain** → enter `closesync.io`.
2. Resend shows DNS records to add (typically: 1 MX, 2 TXT for SPF + DKIM, optionally 1 TXT for DMARC).
3. Add those records at your domain registrar where `closesync.io` lives.
4. Click **Verify** in Resend. Usually green within a few minutes.

When done, tell me "Resend verified" and I'll do Steps 2 & 3.

## Step 2 — Update the app sender (I do this)

In `supabase/functions/send-email/index.ts`, change:
```
FROM_DEFAULT = "CloseSync AI <notifications@notify.closesync.io>"
```
to:
```
FROM_DEFAULT = "CloseSync AI <notify@closesync.io>"
```
Then redeploy the function. All transactional emails (proposals, retainers, recovery) will start sending from `notify@closesync.io`.

## Step 3 — Route Supabase auth emails through Resend (I guide, you click)

Auth emails (signup confirm, password reset, magic link) currently fall back to `no-reply@auth.lovable.cloud` because Lovable Emails is disabled. To send them from `notify@closesync.io`, you point Supabase Auth at Resend's SMTP server.

In **Cloud → Users → Auth Settings** (gear icon) → **SMTP Settings**, enable Custom SMTP and enter:
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: your Resend API key (starts with `re_…`)
- Sender email: `notify@closesync.io`
- Sender name: `CloseSync AI`

Save. Test by triggering a password reset from `/login`.

## Step 4 — Cleanup (optional, do anytime)

Since you're not using the `notify.closesync.io` subdomain anymore, you can:
- Remove the `notify.closesync.io NS ns3.lovable.cloud` and `NS ns4.lovable.cloud` records at your registrar.
- This is purely housekeeping — nothing breaks if you leave them.

---

## What I need from you to start

Just confirm Step 1 is done (Resend shows `closesync.io` as Verified), then say go and I'll handle Steps 2 & 3.
