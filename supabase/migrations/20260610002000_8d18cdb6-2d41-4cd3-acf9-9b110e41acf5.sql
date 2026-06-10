
DO $$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='automations_test_all';
  src := replace(src, '''S'', ''a@b.com''', '''Signer'', ''a@b.com''');
  EXECUTE src;
END $$;
