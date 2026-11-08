-- Disposable database only. Roll back all fixtures after exercising RLS.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000c001', 'resend-inbox-a@example.invalid', '{}'),
  ('00000000-0000-4000-8000-00000000c002', 'resend-inbox-b@example.invalid', '{}');
INSERT INTO public.user_inbound_aliases (user_id, slug) VALUES
  ('00000000-0000-4000-8000-00000000c001', 'aabbcc000001'),
  ('00000000-0000-4000-8000-00000000c002', 'aabbcc000002')
ON CONFLICT (user_id) DO UPDATE SET slug = EXCLUDED.slug;

DO $$
DECLARE email_id uuid := '4ef9a417-02e9-4d39-ad75-9611e0fcc33c';
BEGIN
  IF public.record_resend_inbound_email(email_id, 'aabbcc000001', '00000000-0000-4000-8000-00000000c002',
    'prospect@example.invalid', 'Enquiry', 'Body') <> 'unknown_alias' THEN
    RAISE EXCEPTION 'A mismatch in alias ownership must be rejected';
  END IF;
  IF public.record_resend_inbound_email(email_id, 'aabbcc000001', '00000000-0000-4000-8000-00000000c001',
    'prospect@example.invalid', 'Enquiry', 'Body') <> 'stored' THEN
    RAISE EXCEPTION 'Verified email was not stored';
  END IF;
  IF public.record_resend_inbound_email(email_id, 'aabbcc000002', '00000000-0000-4000-8000-00000000c002',
    'prospect@example.invalid', 'Enquiry', 'Body') <> 'duplicate' THEN
    RAISE EXCEPTION 'A delivery replay must never create another inbox item';
  END IF;
  IF has_function_privilege('authenticated', 'public.record_resend_inbound_email(uuid,text,uuid,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.record_resend_inbound_email(uuid,text,uuid,text,text,text)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.resend_inbound_receipts', 'SELECT') THEN
    RAISE EXCEPTION 'The inbound receipt ledger must remain private';
  END IF;
  IF has_table_privilege('authenticated', 'public.sending_domains', 'INSERT')
    OR has_table_privilege('authenticated', 'public.sending_domains', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.sending_domains', 'DELETE')
    OR NOT has_table_privilege('service_role', 'public.sending_domains', 'INSERT') THEN
    RAISE EXCEPTION 'Only the domain management service may change provider verification';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000c001","role":"authenticated"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.inbound_messages WHERE classification = 'needs_review' AND subject = 'Enquiry') <> 1 THEN
    RAISE EXCEPTION 'The intended workspace must receive one review item';
  END IF;
END $$;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000c002","role":"authenticated"}';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.inbound_messages WHERE subject = 'Enquiry') THEN
    RAISE EXCEPTION 'A second workspace can see a foreign inbox item';
  END IF;
END $$;

ROLLBACK;
