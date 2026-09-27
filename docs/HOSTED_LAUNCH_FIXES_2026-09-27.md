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
  verification and actual delivery have not been confirmed. There is no automatic
  fallback sender in this hook.
- Auth site URL, redirect allowlist and Google/Apple provider enablement could
  not be read through the available connector. Check the actual published,
  custom-domain and preview redirect URLs in Cloud authentication settings.
- Authenticated hosted checkout, test payment completion, webhook processing,
  cancellation, inbound mail and outgoing mail still require end-to-end tests.

Terms and Privacy remain explicit drafts at the owner's request. No credentials,
DNS settings, client messages, live payments or policy text are changed by this
source release.
