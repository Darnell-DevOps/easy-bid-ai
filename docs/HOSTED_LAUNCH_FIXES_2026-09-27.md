# Hosted launch fixes — 27 September 2026

## Billing testing

The owner selected sandbox payments. Lovable created active monthly GBP prices
with no trial or setup fee:

- Starter: £9/month, `pri_01m3gvrgxz95z70bp9097hvmsg`.
- Pro: £29/month, `pri_01m3gvrjmpc2c662qf502ymv1y`.

Lovable set `PAYMENTS_ENVIRONMENT=sandbox` and the corresponding sandbox plan
price-ID secrets. The sandbox API key and webhook secret were already present.
The six existing payment Edge Functions were redeployed unchanged. Anonymous
checkout requests and unsigned webhook requests are rejected. This verifies
configuration and authentication, not a completed payment or webhook cycle.

Published builds now use the public sandbox token by default. A production Vite
build must not automatically select live payments while the server is sandbox.
The regression test checks this behavior. `VITE_PAYMENTS_CLIENT_TOKEN` remains an
explicit override. A future live release requires a matching live browser token,
server mode, catalogue prices and webhook configuration, plus provider testing.

## Automation repair

`20260927080000_consolidate_automation_schedules.sql` removes six obsolete direct
HTTP schedules whose work is already handled by the dispatcher. It preserves the
dispatcher and database-only daily tick. The dispatcher request timeout increases
from pg_net's five-second default to 120 seconds; normal scheduled runs verify
health without manually sending reminders.

The separate daily trash-purge command now authenticates using the Vault cron
secret. Its schedule is deliberately **disabled**. Five expired trashed clients
were present during the read-only audit, and the owner explicitly asked to keep
permanent purging disabled. No purge is executed during deployment or validation.

## CI repair

Database CI now uses `supabase/setup-cli@v3` and the fixed CLI version `2.84.2`.
This avoids the old action's unauthenticated GitHub latest-release lookup, which
failed with a rate-limit error. The migration check still starts a disposable
database and rebuilds all migrations. See the [official action documentation](https://github.com/supabase/setup-cli).

## External configuration still required

- `leads.closesync.io` has no MX records. An inbound provider must route mail to
  the webhook and supply each alias's `inbound_secret`. Four alias records were
  inspected; none lacked that secret. `LEAD_QUALIFY_SECRET` is unrelated to this
  authentication.
- Lovable's `notify.closesync.io` sender-domain verification expired. DNS must
  publish the TXT verification record shown in Lovable and delegate the `notify`
  subdomain to `ns3.lovable.cloud` and `ns4.lovable.cloud`, followed by verification.
  Existing main-domain Google Workspace MX records must remain intact.
- The auth email hook uses Resend from `notify@closesync.io`, which is a different
  sender domain from `notify.closesync.io`. A Resend key exists, but sender-domain
  verification and actual delivery have not been confirmed. A read-only domains
  query returned `restricted_api_key`: the existing Resend connection has Sending
  access, which cannot list domain verification. Verify the domain in the Resend
  dashboard; do not broaden the sending key just to inspect it. There is no
  automatic fallback sender in this hook.
- Auth configuration was subsequently verified in the Cloud UI: Email, Google
  and Apple sign-in are enabled; Site URL is `https://easy-bid-ai.lovable.app`;
  the redirect allowlist includes the published site, `closesync.io` and
  `www.closesync.io`. Existing project preview destinations are also present.
- Authenticated hosted checkout, test payment completion, webhook processing,
  cancellation, inbound mail and outgoing mail still require end-to-end tests.

Terms and Privacy remain explicit drafts at the owner's request. No credentials,
DNS settings, client messages, live payments or policy text are changed by this
source release.

## Release verification

- Source release: `eb5bb091f5a178a41983e31956fc6874dae00b20`, synced and published
  through Lovable.
- All four [GitHub launch checks](https://github.com/Darnell-DevOps/easy-bid-ai/actions/runs/36303529696)
  passed: 362 unit tests, production build, critical Edge Function typecheck,
  full migration rebuild and 76 browser tests. One credential-dependent
  signing test remains skipped.
- The cloud migration was applied through Lovable's supported migration tool.
  Exactly three schedules remain: active five-minute dispatcher, active
  database-only daily tick, and disabled daily trash purge.
- The next natural dispatcher run returned HTTP 200 without a timeout at
  07:40 UTC. All eight registry jobs remain enabled with no current error;
  due contract-generation retries succeeded at 07:40:05 UTC. Other jobs were
  not due on that tick. Nothing was triggered manually.
- Both invoker functions deny execution to anonymous and authenticated app
  users. The service role retains execution access. All five trashed clients
  remain present.
- Signed-in browser testing opened Starter and Pro checkout against the hosted
  backend. Paddle showed Test Mode and the correct £9/month and £29/month
  amounts. Both were closed unpaid; the account remained on Free. No payment
  or subscription cancellation was completed.
- Public DNS currently delegates `closesync.io` to `solar.dns-parking.com` and
  `lunar.dns-parking.com`. DNS-account access is still needed for mail routing
  and sender verification; no DNS records were changed.
