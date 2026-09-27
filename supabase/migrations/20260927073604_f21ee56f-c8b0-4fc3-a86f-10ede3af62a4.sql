-- The dispatcher already owns these six jobs. The old direct HTTP schedules
-- omit cron authentication and generate 401s without doing useful work.
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'booking-reminder-30min',
      'contract-reminder-cron-hourly',
      'lead-digest-daily',
      'onboarding-reminder-cron-hourly',
      'proposal-follow-up-cron',
      'testimonial-cron-30min'
    )
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoke_automation_dispatcher()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  BEGIN
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
      INTO v_secret USING 'cron_secret';
  EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
    RAISE EXCEPTION 'Vault is not available; add the cron_secret Vault secret before enabling the dispatcher';
  END;

  IF COALESCE(v_secret, '') = '' THEN
    RAISE EXCEPTION 'Missing Vault secret: cron_secret';
  END IF;

  SELECT net.http_post(
    url := 'https://avtogztwdoemxuffnwyv.supabase.co/functions/v1/automation-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('scheduled_at', now()),
    -- Jobs run sequentially and regularly exceed pg_net's five-second default.
    timeout_milliseconds := 120000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_automation_dispatcher() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_automation_dispatcher() TO service_role;

-- Trash purge remains a separate daily operation, rather than inheriting the
-- dispatcher's immediate due-job execution. It reads authentication from Vault.
CREATE OR REPLACE FUNCTION public.invoke_expired_trash_purge()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
    INTO v_secret USING 'cron_secret';
  IF COALESCE(v_secret, '') = '' THEN
    RAISE EXCEPTION 'Missing Vault secret: cron_secret';
  END IF;

  SELECT net.http_post(
    url := 'https://avtogztwdoemxuffnwyv.supabase.co/functions/v1/purge-expired-trash',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('scheduled_at', now()),
    timeout_milliseconds := 120000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_expired_trash_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_expired_trash_purge() TO service_role;

-- Repair the command, but keep irreversible deletion disabled until the owner
-- approves it. Five expired clients were present during the production audit.
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'purge-expired-trash-daily'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
  SELECT cron.schedule(
    'purge-expired-trash-daily',
    '0 3 * * *',
    $cron$ SELECT public.invoke_expired_trash_purge(); $cron$
  ) INTO v_job_id;
  PERFORM cron.alter_job(v_job_id, active := false);
END;
$$;