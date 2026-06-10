
-- Targeted patch: rewrite the function source by string replacement isn't possible; just CREATE OR REPLACE with a tiny wrapper that performs the substitution itself via dynamic SQL.
DO $$
DECLARE
  src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='automations_test_all';

  src := replace(src, 'billing_cycle', 'billing_interval');
  -- pg_get_functiondef returns "CREATE OR REPLACE FUNCTION ..." — execute it
  EXECUTE src;
END $$;
