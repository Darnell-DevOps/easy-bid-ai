\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.retainers
  (id, user_id, client_name, title, amount_cents, currency, billing_interval, status, start_date)
SELECT ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '20000000-0000-4000-8000-000000000100', 'Monthly QA', 'Agreement ' || n,
  125000, 'GBP', 'monthly', 'active', '2026-01-31'::date
FROM generate_series(1, 10) n;
UPDATE public.retainers SET tax_mode = 'exclusive', tax_rate = 20 WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.retainers SET currency = 'USD', amount_cents = 10050 WHERE id = '20000000-0000-4000-8000-000000000002';
UPDATE public.retainers SET end_date = '2026-02-10' WHERE id = '20000000-0000-4000-8000-000000000003';
UPDATE public.retainers SET status = 'paused' WHERE id = '20000000-0000-4000-8000-000000000005';
UPDATE public.retainers SET paddle_subscription_id = 'sub_monthly_qa' WHERE id = '20000000-0000-4000-8000-000000000006';
UPDATE public.retainers SET start_date = '2026-03-01' WHERE id = '20000000-0000-4000-8000-000000000007';
UPDATE public.retainers SET user_id = '20000000-0000-4000-8000-000000000101' WHERE id = '20000000-0000-4000-8000-000000000008';
UPDATE public.retainers SET deleted_at = now() WHERE id = '20000000-0000-4000-8000-000000000010';
INSERT INTO public.retainer_invoices (retainer_id, user_id, amount_cents, currency, due_date, status)
VALUES ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000100', 125000, 'GBP', '2026-02-28', 'paid');
INSERT INTO public.retainer_billing_items (retainer_id, billing_month, kind, title, amount_cents, currency, status)
VALUES
  ('20000000-0000-4000-8000-000000000001', '2026-02-01', 'extra', 'Approved one-off', 35000, 'GBP', 'approved'),
  ('20000000-0000-4000-8000-000000000001', '2026-02-01', 'extra', 'Pending one-off', 18000, 'GBP', 'pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000100', true);
SELECT public.prepare_retainer_billing_item('20000000-0000-4000-8000-000000000200',
  '20000000-0000-4000-8000-000000000009', '2026-02-01', 'base');

DO $$
DECLARE result jsonb;
BEGIN
  IF (SELECT count(*) FROM public.preview_retainer_billing_month('2026-02-01')) <> 5
    OR (SELECT count(*) FROM public.preview_retainer_billing_month('2026-02-01') WHERE preparation_state = 'needs_preparation') <> 2
    OR NOT EXISTS (SELECT FROM public.preview_retainer_billing_month('2026-02-01')
      WHERE retainer_id = '20000000-0000-4000-8000-000000000001' AND amount_cents = 150000 AND billing_due_date = '2026-02-28')
  THEN RAISE EXCEPTION 'Preview includes ineligible accounts or incorrect tax/date'; END IF;
  result := public.prepare_retainer_billing_month('2026-02-01');
  IF result <> '{"prepared":2,"unchanged":1,"excluded":2}'::jsonb THEN
    RAISE EXCEPTION 'Incorrect batch result: %', result;
  END IF;
  result := public.prepare_retainer_billing_month('2026-02-01');
  IF result <> '{"prepared":0,"unchanged":3,"excluded":2}'::jsonb THEN
    RAISE EXCEPTION 'Retry duplicated monthly fees: %', result;
  END IF;
  IF NOT EXISTS (SELECT FROM public.retainer_billing_items
    WHERE retainer_id = '20000000-0000-4000-8000-000000000002' AND kind = 'base' AND currency = 'USD' AND amount_cents = 10050)
    OR (SELECT count(*) FROM public.retainer_billing_items WHERE kind = 'extra' AND billing_month = '2026-02-01') <> 2
    OR NOT EXISTS (SELECT FROM public.retainer_billing_items WHERE title = 'Pending one-off' AND status = 'pending')
  THEN RAISE EXCEPTION 'Batch changed currency, extras or approval state'; END IF;
  BEGIN
    PERFORM public.prepare_retainer_billing_month('2026-02-15');
    RAISE EXCEPTION USING ERRCODE = '22000', MESSAGE = 'Invalid month accepted';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;

RESET ROLE;
UPDATE public.retainers SET amount_cents = 250000 WHERE id = '20000000-0000-4000-8000-000000000009';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM public.preview_retainer_billing_month('2026-02-01')
    WHERE retainer_id = '20000000-0000-4000-8000-000000000009' AND amount_cents = 125000)
  THEN RAISE EXCEPTION 'Recorded fee was silently repriced'; END IF;
  PERFORM public.prepare_retainer_billing_month('2026-03-01');
  IF EXISTS (SELECT FROM public.retainer_billing_items WHERE kind = 'extra' AND billing_month = '2026-03-01') THEN
    RAISE EXCEPTION 'One-off extras carried into the next month';
  END IF;
END $$;

-- A later invalid agreement must roll back earlier fees in the same transaction.
RESET ROLE;
UPDATE public.retainers SET amount_cents = 0 WHERE id = '20000000-0000-4000-8000-000000000009';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.prepare_retainer_billing_month('2026-04-01');
    RAISE EXCEPTION USING ERRCODE = '22000', MESSAGE = 'Invalid fee accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT FROM public.retainer_billing_items WHERE billing_month = '2026-04-01') THEN
    RAISE EXCEPTION 'Failed batch left partial monthly fees';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000102', true);
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.preview_retainer_billing_month('2026-02-01'))
    OR public.prepare_retainer_billing_month('2026-02-01') <> '{"prepared":0,"unchanged":0,"excluded":0}'::jsonb
  THEN RAISE EXCEPTION 'Another owner can preview or prepare fees'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.prepare_retainer_billing_month('2026-02-01');
    RAISE EXCEPTION 'Missing identity accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF has_function_privilege('anon', 'public.prepare_retainer_billing_month(date)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.preview_retainer_billing_month(date)', 'EXECUTE')
  THEN RAISE EXCEPTION 'Anonymous role has fee preparation access'; END IF;
END $$;
ROLLBACK;
