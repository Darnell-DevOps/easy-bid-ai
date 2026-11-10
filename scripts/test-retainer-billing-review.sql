\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.retainers
  (id, user_id, client_name, title, description, amount_cents, currency, billing_interval, status, start_date, next_billing_date)
VALUES
  ('09000000-0000-4000-8000-000000000001','09000000-0000-4000-8000-000000000010',
    'Billing QA studio', 'Search retainer', 'Monthly SEO only',125000,'GBP','monthly','active','2026-01-31','2026-02-28'),
  ('09000000-0000-4000-8000-000000000002','09000000-0000-4000-8000-000000000010',
    'Billing QA studio', 'Legacy retainer', 'Weekly support',15000,'GBP','weekly','active',current_date,current_date),
  ('09000000-0000-4000-8000-000000000008','09000000-0000-4000-8000-000000000010',
    'Billing QA studio', 'Failure fixture', 'Weekly support',15000,'GBP','weekly','active',current_date,current_date);
UPDATE public.retainers SET agreement_url = 'https://example.test/private',
  access_token = 'retainer-approval-test-legacy-token' WHERE id = '09000000-0000-4000-8000-000000000001';
UPDATE public.retainers SET tax_rate = 20, tax_mode = 'exclusive' WHERE id = '09000000-0000-4000-8000-000000000002';
UPDATE public.retainers SET total_billed_cents = 2147483647 WHERE id = '09000000-0000-4000-8000-000000000008';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000010',true);

SELECT public.prepare_retainer_billing_item(
  '09000000-0000-4000-8000-000000000003','09000000-0000-4000-8000-000000000001','2026-02-01',
  'extra','Landing page','A standalone landing page',35000);
SELECT set_config('test.approval_token',
  (SELECT approval_token FROM public.retainer_billing_items WHERE id = '09000000-0000-4000-8000-000000000003'), true);

DO $$
BEGIN
  BEGIN
    PERFORM public.update_retainer_billing_item('09000000-0000-4000-8000-000000000003','invoice','INV-01');
    RAISE EXCEPTION USING ERRCODE = '22000', MESSAGE = 'Pending item was billed';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$
BEGIN
  IF has_table_privilege('public.retainer_billing_items','SELECT') THEN
    RAISE EXCEPTION 'Anonymous role has direct table access';
  END IF;
  IF EXISTS (SELECT FROM public.read_retainer_extra(repeat('0',64))) THEN
    RAISE EXCEPTION 'Unknown link returned an approval';
  END IF;
  IF NOT EXISTS (SELECT FROM public.public_get_retainer_by_token('retainer-approval-test-legacy-token')
    WHERE title = 'Search retainer' AND agreement_url IS NULL) THEN
    RAISE EXCEPTION 'Legacy checkout failed or exposed the private agreement link';
  END IF;
  IF (SELECT status FROM public.read_retainer_extra(current_setting('test.approval_token'))) IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Valid token did not resolve to pending work';
  END IF;
  IF public.decide_retainer_extra(current_setting('test.approval_token'),'approved','Client QA') <> 'approved'
    OR public.decide_retainer_extra(current_setting('test.approval_token'),'declined','Second decision') <> 'approved' THEN
    RAISE EXCEPTION 'A retry changed the original decision';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000011',true);
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.retainer_billing_items) THEN
    RAISE EXCEPTION 'Another workspace can read the billing item';
  END IF;
  BEGIN
    PERFORM public.update_retainer_billing_item('09000000-0000-4000-8000-000000000003','invoice','INV-01');
    RAISE EXCEPTION USING ERRCODE = '22000', MESSAGE = 'Another workspace billed an item';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000010',true);
SELECT public.prepare_retainer_billing_item(
  '09000000-0000-4000-8000-000000000004','09000000-0000-4000-8000-000000000001','2026-02-01','base');
SELECT public.prepare_retainer_billing_item(
  '09000000-0000-4000-8000-000000000005','09000000-0000-4000-8000-000000000001','2026-02-01','base');
SELECT public.prepare_retainer_billing_item(
  '09000000-0000-4000-8000-000000000006','09000000-0000-4000-8000-000000000001','2026-03-01','base');
SELECT public.update_retainer_billing_item('09000000-0000-4000-8000-000000000003','invoice','INV-01');
SELECT public.update_retainer_billing_item('09000000-0000-4000-8000-000000000003','invoice','INV-01');
SELECT public.update_retainer_billing_item('09000000-0000-4000-8000-000000000003','paid');
SELECT public.update_retainer_billing_item('09000000-0000-4000-8000-000000000003','paid');

SELECT public.record_manual_retainer_payment('09000000-0000-4000-8000-000000000002',
  '09000000-0000-4000-8000-000000000007', current_date, current_date + 7);
SELECT public.record_manual_retainer_payment('09000000-0000-4000-8000-000000000002',
  '09000000-0000-4000-8000-000000000007', current_date, current_date + 7);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.retainer_billing_items) <> 3
    OR (SELECT sum(amount_cents) FROM public.retainer_billing_items WHERE billing_month = '2026-03-01') <> 125000
    OR NOT EXISTS (SELECT 1 FROM public.retainer_billing_items WHERE kind = 'base'
      AND billing_month = '2026-02-01' AND billing_due_date = '2026-02-28')
    OR NOT EXISTS (SELECT 1 FROM public.retainer_billing_items WHERE kind = 'extra'
      AND status = 'paid' AND invoice_reference = 'INV-01' AND decided_by = 'Client QA' AND paid_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Billing lines, decision or second period are incorrect'; END IF;
  IF (SELECT count(*) FROM public.retainer_invoices WHERE retainer_id = '09000000-0000-4000-8000-000000000002') <> 1
    OR NOT EXISTS (SELECT 1 FROM public.retainers WHERE id = '09000000-0000-4000-8000-000000000002'
      AND total_payments_count = 1 AND total_billed_cents = 18000)
  THEN RAISE EXCEPTION 'Legacy payment retry duplicated the receipt or totals'; END IF;
  BEGIN
    PERFORM public.record_manual_retainer_payment('09000000-0000-4000-8000-000000000008',
      '09000000-0000-4000-8000-000000000009', current_date, current_date + 7);
    RAISE EXCEPTION 'Invalid total unexpectedly succeeded';
  EXCEPTION WHEN numeric_value_out_of_range THEN NULL;
  END;
  IF EXISTS (SELECT FROM public.retainer_invoices WHERE retainer_id = '09000000-0000-4000-8000-000000000008') THEN
    RAISE EXCEPTION 'Failed balance update left a paid invoice behind';
  END IF;
END $$;

ROLLBACK;
