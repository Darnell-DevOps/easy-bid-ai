ALTER TABLE public.retainers ADD COLUMN agreement_url text;
ALTER TABLE public.retainers ADD CONSTRAINT retainers_agreement_url_check
  CHECK (agreement_url IS NULL OR (length(agreement_url) <= 2048 AND agreement_url ~ '^https://[^[:space:]]+$'));

-- The legacy subscribe endpoint returns a retainer row. Keep the new owner-only link private.
CREATE OR REPLACE FUNCTION public.public_get_retainer_by_token(_token text)
RETURNS SETOF public.retainers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (jsonb_populate_record(NULL::public.retainers, to_jsonb(r) - 'agreement_url')).*
  FROM public.retainers r WHERE r.access_token = _token AND r.deleted_at IS NULL LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_get_retainer_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_retainer_by_token(text) TO anon, authenticated;

CREATE TABLE public.retainer_billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retainer_id uuid NOT NULL REFERENCES public.retainers(id) ON DELETE CASCADE,
  billing_month date NOT NULL CHECK (extract(day FROM billing_month) = 1),
  billing_due_date date,
  kind text NOT NULL CHECK (kind IN ('base', 'extra')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description text CHECK (length(description) <= 2000),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('pending', 'declined', 'withdrawn', 'approved', 'invoiced', 'paid')),
  approval_token text UNIQUE,
  expires_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  invoice_reference text,
  invoiced_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX retainer_billing_one_base_per_month
  ON public.retainer_billing_items (retainer_id, billing_month) WHERE kind = 'base';
CREATE INDEX retainer_billing_items_by_retainer
  ON public.retainer_billing_items (retainer_id, billing_month);

ALTER TABLE public.retainer_billing_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retainer_billing_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.retainer_billing_items TO authenticated;
CREATE POLICY "Owners read billing review" ON public.retainer_billing_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.retainers r WHERE r.id = retainer_id AND r.user_id = (SELECT auth.uid()) AND r.deleted_at IS NULL
  ));

CREATE FUNCTION public.prepare_retainer_billing_item(
  _id uuid, _retainer uuid, _month date, _kind text,
  _title text DEFAULT NULL, _description text DEFAULT NULL, _amount integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r public.retainers;
  item public.retainer_billing_items;
  due date;
  amount integer;
BEGIN
  SELECT * INTO r FROM public.retainers
    WHERE id = _retainer AND user_id = auth.uid() AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retainer unavailable'; END IF;
  SELECT * INTO item FROM public.retainer_billing_items WHERE id = _id AND retainer_id = r.id;
  IF FOUND THEN RETURN to_jsonb(item); END IF;
  IF r.status <> 'active' OR r.billing_interval <> 'monthly' OR r.paddle_subscription_id IS NOT NULL
    OR _month IS NULL OR NOT isfinite(_month) OR extract(day FROM _month) <> 1
    OR _month < date_trunc('month', r.start_date)::date
    OR (r.end_date IS NOT NULL AND _month > date_trunc('month', r.end_date)::date)
  THEN RAISE EXCEPTION 'Choose a month within an active monthly retainer billed outside CloseSync'; END IF;

  IF _kind = 'base' THEN
    SELECT * INTO item FROM public.retainer_billing_items
      WHERE retainer_id = r.id AND billing_month = _month AND kind = 'base';
    IF FOUND THEN RETURN to_jsonb(item); END IF;
    due := _month + (least(extract(day FROM r.start_date),
      extract(day FROM (_month + interval '1 month - 1 day')))::int - 1);
    IF r.end_date IS NOT NULL AND due > r.end_date THEN
      RAISE EXCEPTION 'This retainer ends before its billing day';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.retainer_invoices i WHERE i.retainer_id = r.id AND i.user_id = r.user_id
        AND i.status = 'paid' AND i.due_date >= _month AND i.due_date < _month + interval '1 month'
    ) THEN RAISE EXCEPTION 'A base payment is already recorded for this month'; END IF;
    amount := r.amount_cents + CASE WHEN r.tax_mode = 'exclusive' AND r.tax_rate > 0
      THEN round(r.amount_cents * coalesce(r.tax_rate, 0) / 100)::int ELSE 0 END;
    INSERT INTO public.retainer_billing_items
      (id, retainer_id, billing_month, billing_due_date, kind, title, amount_cents, currency, status)
      VALUES (_id, r.id, _month, due, 'base', 'Monthly retainer', amount, upper(r.currency), 'approved')
      RETURNING * INTO item;
  ELSIF _kind = 'extra' THEN
    IF coalesce(length(btrim(r.description)), 0) = 0 AND r.agreement_url IS NULL THEN
      RAISE EXCEPTION 'Add the agreed scope or agreement link before creating an extra';
    END IF;
    IF coalesce(length(btrim(_title)), 0) NOT BETWEEN 1 AND 120
      OR coalesce(length(btrim(_description)), 0) NOT BETWEEN 1 AND 2000
      OR _amount IS NULL OR _amount NOT BETWEEN 1 AND 999999999
    THEN RAISE EXCEPTION 'Enter the extra work and its final price'; END IF;
    INSERT INTO public.retainer_billing_items
      (id, retainer_id, billing_month, kind, title, description, amount_cents, currency, status, approval_token, expires_at)
      VALUES (_id, r.id, _month, 'extra', btrim(_title), btrim(_description), _amount, upper(r.currency),
        'pending', encode(extensions.gen_random_bytes(32), 'hex'), now() + interval '30 days')
      RETURNING * INTO item;
  ELSE
    RAISE EXCEPTION 'Invalid billing item';
  END IF;
  RETURN to_jsonb(item);
END;
$$;

CREATE FUNCTION public.update_retainer_billing_item(_id uuid, _action text, _reference text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE item public.retainer_billing_items;
BEGIN
  SELECT i.* INTO item FROM public.retainer_billing_items i
    JOIN public.retainers r ON r.id = i.retainer_id
    WHERE i.id = _id AND r.user_id = auth.uid() AND r.deleted_at IS NULL FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing item unavailable'; END IF;
  IF _action = 'invoice' AND item.status = 'approved' AND length(btrim(_reference)) BETWEEN 1 AND 100 THEN
    UPDATE public.retainer_billing_items SET status = 'invoiced', invoice_reference = btrim(_reference), invoiced_at = now()
      WHERE id = _id RETURNING * INTO item;
  ELSIF _action = 'paid' AND item.status = 'invoiced' THEN
    UPDATE public.retainer_billing_items SET status = 'paid', paid_at = now()
      WHERE id = _id RETURNING * INTO item;
  ELSIF _action = 'withdraw' AND item.status = 'pending' THEN
    UPDATE public.retainer_billing_items SET status = 'withdrawn', decided_at = now(), approval_token = NULL
      WHERE id = _id RETURNING * INTO item;
  ELSIF NOT coalesce((
    (_action = 'invoice' AND item.status IN ('invoiced', 'paid') AND item.invoice_reference = btrim(coalesce(_reference, '')))
    OR (_action = 'paid' AND item.status = 'paid')
    OR (_action = 'withdraw' AND item.status = 'withdrawn')
  ), false) THEN
    RAISE EXCEPTION 'This action is unavailable for the current billing status';
  END IF;
  RETURN to_jsonb(item);
END;
$$;

CREATE FUNCTION public.read_retainer_extra(_token text)
RETURNS TABLE (retainer_title text, title text, description text, amount_cents integer,
  currency text, billing_month date, status text, decided_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.title, i.title, i.description, i.amount_cents, i.currency, i.billing_month,
    CASE WHEN i.status IN ('invoiced', 'paid') THEN 'approved' ELSE i.status END, i.decided_at
  FROM public.retainer_billing_items i JOIN public.retainers r ON r.id = i.retainer_id
  WHERE _token ~ '^[a-f0-9]{64}$' AND i.approval_token = _token AND i.kind = 'extra'
    AND i.expires_at > now() AND r.deleted_at IS NULL
    AND (i.status <> 'pending' OR r.status = 'active');
$$;

CREATE FUNCTION public.decide_retainer_extra(_token text, _decision text, _name text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE item public.retainer_billing_items;
BEGIN
  IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$'
    OR _decision IS NULL OR _decision NOT IN ('approved', 'declined')
    OR coalesce(length(btrim(_name)), 0) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'Enter your name and choose a decision'; END IF;
  SELECT i.* INTO item FROM public.retainer_billing_items i JOIN public.retainers r ON r.id = i.retainer_id
    WHERE i.approval_token = _token AND i.kind = 'extra' AND i.expires_at > now()
      AND r.deleted_at IS NULL AND (i.status <> 'pending' OR r.status = 'active') FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approval link unavailable'; END IF;
  IF item.status = 'pending' THEN
    UPDATE public.retainer_billing_items SET status = _decision, decided_by = btrim(_name), decided_at = now()
      WHERE id = item.id;
    RETURN _decision;
  END IF;
  RETURN CASE WHEN item.status IN ('invoiced', 'paid') THEN 'approved' ELSE item.status END;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_retainer_billing_item(uuid, uuid, date, text, text, text, integer),
  public.update_retainer_billing_item(uuid, text, text),
  public.read_retainer_extra(text), public.decide_retainer_extra(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_retainer_billing_item(uuid, uuid, date, text, text, text, integer),
  public.update_retainer_billing_item(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_retainer_extra(text), public.decide_retainer_extra(text, text, text)
  TO anon, authenticated;

-- Keep the legacy manual action atomic and idempotent across retries.
ALTER TABLE public.retainer_invoices ADD COLUMN manual_request_id uuid UNIQUE;

CREATE FUNCTION public.record_manual_retainer_payment(
  _retainer uuid, _request uuid, _expected_due date, _next_due date
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r public.retainers;
  amount integer;
BEGIN
  SELECT * INTO r FROM public.retainers
    WHERE id = _retainer AND user_id = auth.uid() AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retainer unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.retainer_invoices
    WHERE retainer_id = r.id AND user_id = r.user_id AND manual_request_id = _request) THEN RETURN; END IF;
  IF _request IS NULL OR _next_due IS NULL OR NOT isfinite(_next_due)
    OR _expected_due IS DISTINCT FROM r.next_billing_date
    OR _next_due <= greatest(current_date, r.next_billing_date)
    OR r.status <> 'active' OR (r.billing_interval = 'monthly' AND r.paddle_subscription_id IS NULL)
  THEN RAISE EXCEPTION 'Billing state changed. Refresh and try again'; END IF;
  amount := r.amount_cents + CASE WHEN r.tax_mode = 'exclusive' AND r.tax_rate > 0
    THEN round(r.amount_cents * coalesce(r.tax_rate, 0) / 100)::int ELSE 0 END;
  INSERT INTO public.retainer_invoices
    (user_id, retainer_id, amount_cents, currency, due_date, paid_at, status, manual_request_id)
    VALUES (r.user_id, r.id, amount, r.currency, coalesce(r.next_billing_date, current_date), now(), 'paid', _request);
  UPDATE public.retainers SET last_billed_date = current_date, next_billing_date = _next_due,
    total_billed_cents = total_billed_cents + amount, total_payments_count = total_payments_count + 1,
    has_failed_payment = false, failed_payment_reason = NULL, failed_payment_at = NULL
    WHERE id = r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_manual_retainer_payment(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_retainer_payment(uuid, uuid, date, date) TO authenticated;
