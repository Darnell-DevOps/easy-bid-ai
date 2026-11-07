-- Isolate test receipts from the proposal and subscription payment ledgers.
CREATE TABLE public.stripe_sandbox_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 50 AND 99999999),
  currency text NOT NULL CHECK (currency IN ('gbp', 'eur', 'usd')),
  return_origin text NOT NULL,
  expires_at bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'failed', 'paid', 'expired')),
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text
);

CREATE UNIQUE INDEX stripe_sandbox_one_current_checkout
ON public.stripe_sandbox_checkouts (contract_id) WHERE status <> 'expired';

CREATE TABLE public.stripe_sandbox_checkout_events (
  event_id text PRIMARY KEY,
  checkout_id uuid NOT NULL REFERENCES public.stripe_sandbox_checkouts(id) ON DELETE CASCADE
);

ALTER TABLE public.stripe_sandbox_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_sandbox_checkout_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_sandbox_checkouts, public.stripe_sandbox_checkout_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.stripe_sandbox_checkouts TO service_role;

CREATE FUNCTION public.reserve_stripe_sandbox_checkout(_owner uuid, _contract_id uuid, _return_origin text)
RETURNS SETOF public.stripe_sandbox_checkouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE candidate record;
BEGIN
  SELECT a.stripe_account_id, c.amount_cents, lower(c.currency) AS currency INTO candidate
  FROM public.contracts AS c
  JOIN public.client_payment_accounts AS a ON a.user_id = c.user_id AND a.environment = 'test'
  WHERE c.id = _contract_id AND c.user_id = _owner AND c.status = 'executed' AND c.deleted_at IS NULL
    AND c.amount_cents BETWEEN 50 AND 99999999 AND lower(c.currency) IN ('gbp', 'eur', 'usd')
    AND a.details_submitted AND a.charges_enabled AND a.payouts_enabled AND a.card_payments_active;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.stripe_sandbox_checkouts (contract_id, account_id, amount_cents, currency, return_origin, expires_at)
  VALUES (_contract_id, candidate.stripe_account_id, candidate.amount_cents, candidate.currency,
    _return_origin, floor(extract(epoch FROM now()))::bigint + 7200)
  ON CONFLICT (contract_id) WHERE status <> 'expired' DO NOTHING;

  RETURN QUERY SELECT * FROM public.stripe_sandbox_checkouts
    WHERE contract_id = _contract_id AND status <> 'expired' AND account_id = candidate.stripe_account_id
      AND amount_cents = candidate.amount_cents AND currency = candidate.currency;
END;
$$;

CREATE FUNCTION public.record_stripe_sandbox_checkout_event(
  _event_id text, _checkout_id uuid, _account_id text, _amount_cents integer, _currency text,
  _session_id text, _payment_intent_id text, _status text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE checkout public.stripe_sandbox_checkouts%ROWTYPE;
BEGIN
  IF _status NOT IN ('paid', 'failed', 'expired') THEN RETURN false; END IF;
  SELECT * INTO checkout FROM public.stripe_sandbox_checkouts WHERE id = _checkout_id FOR UPDATE;
  IF NOT FOUND OR checkout.account_id IS DISTINCT FROM _account_id
    OR checkout.amount_cents IS DISTINCT FROM _amount_cents OR checkout.currency IS DISTINCT FROM _currency
    OR (_session_id IS NOT NULL AND checkout.stripe_session_id IS NOT NULL AND _session_id <> checkout.stripe_session_id)
    OR (_payment_intent_id IS NOT NULL AND checkout.stripe_payment_intent_id IS NOT NULL
      AND _payment_intent_id <> checkout.stripe_payment_intent_id) THEN
    RETURN false;
  END IF;

  INSERT INTO public.stripe_sandbox_checkout_events (event_id, checkout_id) VALUES (_event_id, _checkout_id)
    ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN RETURN true; END IF;

  IF checkout.status NOT IN ('paid', 'expired') THEN
    UPDATE public.stripe_sandbox_checkouts
    SET status = _status,
      stripe_session_id = coalesce(stripe_session_id, _session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, _payment_intent_id)
    WHERE id = _checkout_id;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_stripe_sandbox_checkout(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stripe_sandbox_checkout_event(text, uuid, text, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stripe_sandbox_checkout(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_sandbox_checkout_event(text, uuid, text, integer, text, text, text, text) TO service_role;
