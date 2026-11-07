-- Run only on a fresh disposable Supabase instance. Every fixture rolls back.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000a001', 'tenant-a@example.invalid', '{}'),
  ('00000000-0000-4000-8000-00000000b001', 'tenant-b@example.invalid', '{}');

INSERT INTO public.clients (id, user_id, name) VALUES
  ('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000a001', 'Client A'),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000b001', 'Client B');
INSERT INTO public.proposals (id, user_id, client_name, company_name, service_type) VALUES
  ('00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000a001', 'A', 'Studio A', 'Design'),
  ('00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000b001', 'B', 'Studio B', 'Design');
INSERT INTO public.contracts (user_id, title, body, status, signing_token) VALUES
  ('00000000-0000-4000-8000-00000000a001', 'A contract', 'Fixture', 'sent', 'canary_A_test_signing_token_0123456789'),
  ('00000000-0000-4000-8000-00000000b001', 'B contract', 'Fixture', 'sent', 'canary_B_test_signing_token_0123456789');
INSERT INTO public.onboarding_forms (user_id, client_name) VALUES
  ('00000000-0000-4000-8000-00000000a001', 'Onboarding A'),
  ('00000000-0000-4000-8000-00000000b001', 'Onboarding B');
INSERT INTO public.client_payment_accounts (user_id, environment, stripe_account_id, country) VALUES
  ('00000000-0000-4000-8000-00000000a001', 'test', 'acct_TenantFixtureA', 'GB'),
  ('00000000-0000-4000-8000-00000000b001', 'test', 'acct_TenantFixtureB', 'GB');

-- The hosted bucket is provisioned by the Storage API, outside migrations.
INSERT INTO storage.buckets (id, name, public) VALUES ('form-uploads', 'form-uploads', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('form-uploads', '00000000-0000-4000-8000-00000000a001/test-a.pdf'),
  ('form-uploads', '00000000-0000-4000-8000-00000000b001/test-b.pdf');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}';
DO $$
BEGIN
  IF public.form_attachments_available() OR EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'form-uploads'
  ) THEN
    RAISE EXCEPTION 'The attachment pause must hide even the owner''s files';
  END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES
      ('form-uploads', '00000000-0000-4000-8000-00000000a001/blocked.pdf');
    RAISE EXCEPTION 'The owner bypassed the attachment pause via Storage';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
INSERT INTO public.internal_config (key, value) VALUES ('form_attachments_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
SET LOCAL ROLE authenticated;
DO $$
DECLARE changed integer;
BEGIN
  IF (SELECT array_agg(name) FROM public.clients) IS DISTINCT FROM ARRAY['Client A'] THEN
    RAISE EXCEPTION 'Tenant A client list is not isolated';
  END IF;
  IF (SELECT array_agg(company_name) FROM public.proposals) IS DISTINCT FROM ARRAY['Studio A'] THEN
    RAISE EXCEPTION 'Tenant A proposal list is not isolated';
  END IF;
  IF (SELECT array_agg(title) FROM public.contracts) IS DISTINCT FROM ARRAY['A contract'] THEN
    RAISE EXCEPTION 'Tenant A contract list is not isolated';
  END IF;
  IF (SELECT array_agg(client_name) FROM public.onboarding_forms) IS DISTINCT FROM ARRAY['Onboarding A'] THEN
    RAISE EXCEPTION 'Tenant A onboarding list is not isolated';
  END IF;
  IF (SELECT array_agg(stripe_account_id) FROM public.client_payment_accounts) IS DISTINCT FROM ARRAY['acct_TenantFixtureA'] THEN
    RAISE EXCEPTION 'Tenant A merchant list is not isolated';
  END IF;
  IF (SELECT array_agg(name) FROM storage.objects WHERE bucket_id = 'form-uploads')
    IS DISTINCT FROM ARRAY['00000000-0000-4000-8000-00000000a001/test-a.pdf'] THEN
    RAISE EXCEPTION 'Tenant A can see foreign upload metadata or cannot see its own';
  END IF;
  UPDATE public.clients SET name = 'Edited own client' WHERE id = '00000000-0000-4000-8000-00000000a002';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Owner update should succeed'; END IF;
  UPDATE public.clients SET name = 'Foreign update' WHERE id = '00000000-0000-4000-8000-00000000b002';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Tenant A could edit B client'; END IF;
  DELETE FROM public.proposals WHERE id = '00000000-0000-4000-8000-00000000b003';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Tenant A could delete B proposal'; END IF;
  BEGIN
    INSERT INTO public.clients (user_id, name) VALUES ('00000000-0000-4000-8000-00000000b001', 'Forged owner');
    RAISE EXCEPTION 'Tenant A could create records for B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES
      ('form-uploads', '00000000-0000-4000-8000-00000000b001/forged.pdf');
    RAISE EXCEPTION 'Tenant A could write to the B upload directory';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.client_payment_accounts SET charges_enabled = true;
    RAISE EXCEPTION 'Tenant A could change a payment readiness flag';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000b001","role":"authenticated"}';
DO $$
BEGIN
  IF (SELECT array_agg(name) FROM public.clients) IS DISTINCT FROM ARRAY['Client B']
    OR (SELECT array_agg(company_name) FROM public.proposals) IS DISTINCT FROM ARRAY['Studio B']
    OR (SELECT array_agg(stripe_account_id) FROM public.client_payment_accounts) IS DISTINCT FROM ARRAY['acct_TenantFixtureB'] THEN
    RAISE EXCEPTION 'Tenant B isolation or integrity failed';
  END IF;
END $$;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$
BEGIN
  IF has_table_privilege(current_user, 'public.contracts', 'SELECT')
    OR has_table_privilege(current_user, 'public.proposals', 'SELECT')
    OR has_table_privilege(current_user, 'public.onboarding_forms', 'SELECT')
    OR has_table_privilege(current_user, 'public.client_payment_accounts', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous direct access to sensitive tables is granted';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'form-uploads') THEN
    RAISE EXCEPTION 'Anonymous access to form upload metadata is granted';
  END IF;
  IF (SELECT count(*) FROM public.public_get_contract_by_token('canary_A_test_signing_token_0123456789')) <> 1
    OR (SELECT count(*) FROM public.public_get_contract_by_token('invalid-token')) <> 0 THEN
    RAISE EXCEPTION 'Public contract token scoping failed';
  END IF;
  INSERT INTO public.landing_events (event, path, meta) VALUES ('cta_click', '/', '{"location":"hero"}');
  BEGIN
    INSERT INTO public.landing_events (event, path, meta) VALUES ('signup_view', '/signup?token=canary', '{}');
    RAISE EXCEPTION 'Analytics accepted a raw query';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.landing_events (event, path, meta) VALUES ('cta_click', '/', '{"location":"hero","email":"canary@example.invalid"}');
    RAISE EXCEPTION 'Analytics accepted private metadata';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.landing_events (event, path, meta, referrer) VALUES ('landing_view', '/', '{}', 'https://example.invalid/canary');
    RAISE EXCEPTION 'Analytics accepted a raw referrer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
\echo Tenant isolation and telemetry database checks passed.
