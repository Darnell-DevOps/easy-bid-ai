CREATE OR REPLACE FUNCTION public.bootstrap_replace_cron_vault_secret(_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE(_value, '') = '' THEN
    RAISE EXCEPTION 'Empty secret value';
  END IF;

  -- Remove any prior entries with the same name so this call is idempotent.
  FOR v_id IN SELECT id FROM vault.secrets WHERE name = 'cron_secret' LOOP
    DELETE FROM vault.secrets WHERE id = v_id;
  END LOOP;

  PERFORM vault.create_secret(_value, 'cron_secret', 'CRON_SECRET for automation-dispatcher');
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_replace_cron_vault_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_replace_cron_vault_secret(TEXT) TO service_role;