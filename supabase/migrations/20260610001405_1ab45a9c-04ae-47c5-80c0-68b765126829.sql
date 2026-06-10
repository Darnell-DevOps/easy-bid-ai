
-- Attach automation triggers to proposals table
DROP TRIGGER IF EXISTS proposals_after_insert_automations ON public.proposals;
CREATE TRIGGER proposals_after_insert_automations
AFTER INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.tg_proposals_after_insert_automations();

DROP TRIGGER IF EXISTS proposals_after_update_automations ON public.proposals;
CREATE TRIGGER proposals_after_update_automations
AFTER UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.tg_proposals_after_update_automations();

-- Cross-user wrapper for the scheduled cron tick
CREATE OR REPLACE FUNCTION public.automations_run_all_ticks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_total int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id FROM public.automation_preferences
    UNION
    SELECT DISTINCT user_id FROM public.proposals
    UNION
    SELECT DISTINCT user_id FROM public.retainers
    UNION
    SELECT DISTINCT user_id FROM public.onboarding_forms
    UNION
    SELECT DISTINCT user_id FROM public.deadlines
  LOOP
    PERFORM public.automations_run_user_ticks(r.user_id);
    v_total := v_total + 1;
  END LOOP;
  RETURN jsonb_build_object('users_processed', v_total, 'ran_at', now());
END;
$$;

-- Schedule daily cron (08:00 UTC) for automation ticks
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automations-daily-tick') THEN
    PERFORM cron.unschedule('automations-daily-tick');
  END IF;
  PERFORM cron.schedule(
    'automations-daily-tick',
    '0 8 * * *',
    $cron$ SELECT public.automations_run_all_ticks(); $cron$
  );
END $$;
