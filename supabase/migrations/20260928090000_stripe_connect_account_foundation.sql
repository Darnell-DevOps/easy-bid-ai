-- One Stripe merchant account per workspace and mode. The browser may only
-- read its own connection; creation and state changes require the service role.
CREATE TABLE IF NOT EXISTS public.client_payment_accounts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('test', 'live')),
  stripe_account_id text NOT NULL UNIQUE CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  card_payments_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, environment)
);

ALTER TABLE public.client_payment_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_payment_accounts FROM anon, authenticated;
GRANT SELECT ON public.client_payment_accounts TO authenticated;
GRANT ALL ON public.client_payment_accounts TO service_role;
CREATE POLICY client_payment_accounts_owner_read ON public.client_payment_accounts
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
