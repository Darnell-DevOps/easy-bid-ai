-- Prepare the owner's monthly fees as one transaction. This only creates review
-- lines; it never issues an invoice, sends an email or initiates a payment.
CREATE FUNCTION public.preview_retainer_billing_month(_month date)
RETURNS TABLE (
  retainer_id uuid, client_name text, title text, billing_due_date date,
  amount_cents integer, currency text, preparation_state text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to review monthly fees' USING ERRCODE = '42501';
  END IF;
  IF _month IS NULL OR NOT isfinite(_month) OR extract(day FROM _month) <> 1 THEN
    RAISE EXCEPTION 'Choose a valid billing month';
  END IF;
  RETURN QUERY
    SELECT r.id, r.client_name, r.title, due.day,
      coalesce(existing.amount_cents, r.amount_cents + CASE
        WHEN r.tax_mode = 'exclusive' AND r.tax_rate > 0
        THEN round(r.amount_cents * r.tax_rate / 100)::int ELSE 0 END),
      coalesce(existing.currency, upper(r.currency)),
      CASE
        WHEN existing.id IS NOT NULL THEN 'prepared'
        WHEN EXISTS (
          SELECT 1 FROM public.retainer_invoices i
          WHERE i.retainer_id = r.id AND i.user_id = r.user_id AND i.status = 'paid'
            AND i.due_date >= _month AND i.due_date < _month + interval '1 month'
        ) THEN 'already_paid'
        WHEN r.end_date IS NOT NULL AND due.day > r.end_date THEN 'ends_before_due_date'
        ELSE 'needs_preparation'
      END
    FROM public.retainers r
    CROSS JOIN LATERAL (SELECT _month + (least(extract(day FROM r.start_date),
      extract(day FROM (_month + interval '1 month - 1 day')))::int - 1) AS day) due
    LEFT JOIN public.retainer_billing_items existing
      ON existing.retainer_id = r.id AND existing.billing_month = _month AND existing.kind = 'base'
    WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL AND r.status = 'active'
      AND r.billing_interval = 'monthly' AND r.paddle_subscription_id IS NULL
      AND _month >= date_trunc('month', r.start_date)::date
      AND (r.end_date IS NULL OR _month <= date_trunc('month', r.end_date)::date)
    ORDER BY r.client_name, r.title, r.id;
END;
$$;

CREATE FUNCTION public.prepare_retainer_billing_month(_month date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  candidate record;
  prepared integer := 0;
  unchanged integer := 0;
  excluded integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to prepare monthly fees' USING ERRCODE = '42501';
  END IF;
  IF _month IS NULL OR NOT isfinite(_month) OR extract(day FROM _month) <> 1 THEN
    RAISE EXCEPTION 'Choose a valid billing month';
  END IF;

  -- Lock in a stable order before calculating eligibility. Single-item billing
  -- and agreement edits take the same row locks, so retries cannot duplicate fees.
  PERFORM r.id FROM public.retainers r
    WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL
    ORDER BY r.id FOR UPDATE;

  FOR candidate IN SELECT * FROM public.preview_retainer_billing_month(_month) LOOP
    IF candidate.preparation_state = 'needs_preparation' THEN
      PERFORM public.prepare_retainer_billing_item(
        gen_random_uuid(), candidate.retainer_id, _month, 'base');
      prepared := prepared + 1;
    ELSIF candidate.preparation_state = 'prepared' THEN
      unchanged := unchanged + 1;
    ELSE
      excluded := excluded + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('prepared', prepared, 'unchanged', unchanged, 'excluded', excluded);
END;
$$;

REVOKE ALL ON FUNCTION public.preview_retainer_billing_month(date),
  public.prepare_retainer_billing_month(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_retainer_billing_month(date),
  public.prepare_retainer_billing_month(date) TO authenticated;
