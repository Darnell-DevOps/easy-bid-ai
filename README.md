# CloseSync

## Paddle plan billing configuration

Plan products and monthly prices must be created in Paddle before deploying the
plan checkout functions. Configure these server-only Supabase Edge Function
secrets:

- `PAYMENTS_ENVIRONMENT`: exactly `sandbox` or `live`
- For sandbox: `PADDLE_SANDBOX_STARTER_PRICE_ID` and
  `PADDLE_SANDBOX_PRO_PRICE_ID`
- For live: `PADDLE_LIVE_STARTER_PRICE_ID` and
  `PADDLE_LIVE_PRO_PRICE_ID`

The matching browser build must use a sandbox or live
`VITE_PAYMENTS_CLIENT_TOKEN`. Never expose Paddle API keys or the server-side
price configuration through Vite variables.

## Scheduled automation configuration

Reminder, digest, recovery, testimonial, and contract-generation retry jobs run
through the `automation-dispatcher` Edge Function. Before enabling the schedule:

1. Generate one strong random value for `CRON_SECRET`.
2. Add it as a Supabase Edge Function secret named `CRON_SECRET`.
3. Add the same value to Supabase Vault with the name `cron_secret`.
4. Deploy `automation-dispatcher`, every registered `*-cron` function, and the
   database migrations before relying on reminders.

The migration schedules the dispatcher every five minutes. Its real results,
durations, and failures are shown under **Admin -> Scheduled automation health**.
Do not call cron functions directly from a browser or expose `CRON_SECRET` in a
Vite environment variable.
