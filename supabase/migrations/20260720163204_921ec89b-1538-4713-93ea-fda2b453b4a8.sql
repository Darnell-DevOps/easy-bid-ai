CREATE TABLE public.automation_job_registry (
  job_name TEXT PRIMARY KEY,
  function_name TEXT NOT NULL UNIQUE,
  interval_minutes INTEGER NOT NULL CHECK (interval_minutes BETWEEN 1 AND 10080),
  enabled BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  last_succeeded_at TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  last_error TEXT,
  last_result JSONB,
  last_duration_ms INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_job_registry ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.automation_job_registry TO authenticated;
GRANT ALL ON public.automation_job_registry TO service_role;

CREATE POLICY "Super admins view automation health"
  ON public.automation_job_registry
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE TRIGGER automation_job_registry_updated_at
  BEFORE UPDATE ON public.automation_job_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.automation_job_registry (job_name, function_name, interval_minutes)
VALUES
  ('booking-reminders', 'booking-reminder-cron', 15),
  ('contract-reminders', 'contract-reminder-cron', 60),
  ('lead-digests', 'lead-digest-cron', 60),
  ('onboarding-reminders', 'onboarding-reminder-cron', 60),
  ('proposal-follow-ups', 'proposal-follow-up-cron', 60),
  ('retainer-recovery', 'retainer-recovery-cron', 60),
  ('testimonial-requests', 'testimonial-cron', 60),
  ('contract-generation-retries', 'contract-generation-retry-cron', 5)
ON CONFLICT (job_name) DO UPDATE
SET function_name = EXCLUDED.function_name,
    interval_minutes = EXCLUDED.interval_minutes;

CREATE OR REPLACE FUNCTION public.claim_due_automation_jobs(_limit INTEGER DEFAULT 20)
RETURNS TABLE(job_name TEXT, function_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT r.job_name
    FROM public.automation_job_registry r
    WHERE r.enabled
      AND r.next_run_at <= now()
    ORDER BY r.next_run_at
    LIMIT LEAST(GREATEST(_limit, 1), 50)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.automation_job_registry r
  SET last_started_at = now(),
      next_run_at = now() + make_interval(mins => r.interval_minutes)
  FROM due
  WHERE r.job_name = due.job_name
  RETURNING r.job_name, r.function_name;
$$;

REVOKE ALL ON FUNCTION public.claim_due_automation_jobs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_automation_jobs(INTEGER) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
    body := jsonb_build_object('scheduled_at', now())
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_automation_dispatcher() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_automation_dispatcher() TO service_role;

DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('retainer-recovery-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('automation-dispatcher-five-minutes'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(
    'automation-dispatcher-five-minutes',
    '*/5 * * * *',
    $cron$ SELECT public.invoke_automation_dispatcher(); $cron$
  );
END;
$$;