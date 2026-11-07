-- Disposable database only. Roll back synthetic users, contracts and receipts.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  owner_id uuid := gen_random_uuid();
  stranger_id uuid := gen_random_uuid();
  proposal_id uuid := gen_random_uuid();
  contract_id uuid := gen_random_uuid();
  attempt uuid;
  replacement uuid;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (owner_id, 'stripe-sandbox-owner@example.invalid', '{}'),
    (stranger_id, 'stripe-sandbox-stranger@example.invalid', '{}');
  INSERT INTO public.proposals (id, user_id, client_name, company_name, service_type)
    VALUES (proposal_id, owner_id, 'Sandbox client', 'Test studio', 'Design');
  INSERT INTO public.contracts (id, user_id, proposal_id, title, body, status, amount_cents, currency)
    VALUES (contract_id, owner_id, proposal_id, 'Sandbox contract', 'Fixture', 'executed', 1500, 'GBP');
  INSERT INTO public.client_payment_accounts (user_id, environment, stripe_account_id, country,
    details_submitted, charges_enabled, payouts_enabled, card_payments_active)
    VALUES (owner_id, 'test', 'acct_StripeSandbox1', 'GB', true, true, true, true);

  IF EXISTS (SELECT 1 FROM public.reserve_stripe_sandbox_checkout(stranger_id, contract_id, 'https://test.example.invalid'))
    OR has_function_privilege('authenticated', 'public.reserve_stripe_sandbox_checkout(uuid, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A caller can start sandbox checkout for another workspace';
  END IF;
  SELECT id INTO attempt FROM public.reserve_stripe_sandbox_checkout(owner_id, contract_id, 'https://test.example.invalid');
  IF attempt IS NULL OR (SELECT id FROM public.reserve_stripe_sandbox_checkout(owner_id, contract_id, 'https://test.example.invalid')) IS DISTINCT FROM attempt THEN
    RAISE EXCEPTION 'Checkout retries must reuse the same reservation';
  END IF;
  IF public.record_stripe_sandbox_checkout_event('evt_Foreign', attempt, 'acct_Other', 1500, 'gbp', 'cs_test_Fixture', 'pi_Fixture', 'paid')
    OR public.record_stripe_sandbox_checkout_event('evt_WrongAmount', attempt, 'acct_StripeSandbox1', 1, 'gbp', 'cs_test_Fixture', 'pi_Fixture', 'paid') THEN
    RAISE EXCEPTION 'Webhook accepted a different account or amount';
  END IF;

  PERFORM public.record_stripe_sandbox_checkout_event('evt_Expired', attempt, 'acct_StripeSandbox1', 1500, 'gbp', 'cs_test_Expired', NULL, 'expired');
  SELECT id INTO replacement FROM public.reserve_stripe_sandbox_checkout(owner_id, contract_id, 'https://test.example.invalid');
  IF replacement IS NULL OR replacement = attempt THEN RAISE EXCEPTION 'An expired checkout must allow a new attempt'; END IF;

  PERFORM public.record_stripe_sandbox_checkout_event('evt_Failed', replacement, 'acct_StripeSandbox1', 1500, 'gbp', NULL, 'pi_Fixture', 'failed');
  IF (SELECT status FROM public.stripe_sandbox_checkouts WHERE id = replacement) <> 'failed' THEN
    RAISE EXCEPTION 'A declined payment did not reach the test ledger';
  END IF;
  PERFORM public.record_stripe_sandbox_checkout_event('evt_Paid', replacement, 'acct_StripeSandbox1', 1500, 'gbp', 'cs_test_Fixture', 'pi_Fixture', 'paid');
  PERFORM public.record_stripe_sandbox_checkout_event('evt_Paid', replacement, 'acct_StripeSandbox1', 1500, 'gbp', 'cs_test_Fixture', 'pi_Fixture', 'paid');
  PERFORM public.record_stripe_sandbox_checkout_event('evt_LateFailure', replacement, 'acct_StripeSandbox1', 1500, 'gbp', NULL, 'pi_Fixture', 'failed');
  IF (SELECT count(*) FROM public.stripe_sandbox_checkout_events WHERE event_id = 'evt_Paid') <> 1
    OR (SELECT status FROM public.stripe_sandbox_checkouts WHERE id = replacement) <> 'paid'
    OR (SELECT client_paid FROM public.proposals WHERE id = proposal_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Sandbox event deduplication, terminal state, or production isolation failed';
  END IF;
END;
$$;

ROLLBACK;
