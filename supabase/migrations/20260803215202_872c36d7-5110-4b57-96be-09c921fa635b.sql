-- 1) Fix mutable search_path on trigger helpers
ALTER FUNCTION public.tg_onboarding_templates_set_updated_at() SET search_path = public;
ALTER FUNCTION public.tg_retainer_templates_set_updated_at() SET search_path = public;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions that should never be API-callable
DO $$
DECLARE
  fn text;
  internal_names text[] := ARRAY[
    'tg_onboarding_templates_set_updated_at','tg_retainer_templates_set_updated_at',
    'tg_booking_advance_kickoff','tg_proposals_after_insert_automations',
    'tg_proposals_after_update_automations','trg_recompute_kickoff_readiness',
    'recompute_kickoff_readiness','enforce_no_booking_overlap','enforce_proposal_plan_limit',
    'custom_domains_enforce_single_primary','handle_new_user_inbound_alias',
    'handle_new_user_subscription','auto_request_review_on_contract_signed',
    'auto_request_review_on_proposal_paid','automations_handle_payment_event',
    'automations_run_all_ticks','automations_run_user_ticks','automations_test_all',
    'trigger_lead_qualify','inbound_alias_lookup','get_contract_owner_email',
    'invoke_automation_dispatcher','claim_due_automation_jobs',
    'bootstrap_replace_cron_vault_secret','update_updated_at_column',
    'user_settings_touch_updated_at','claim_acceptance_contract_generation',
    'set_acceptance_contract_generation_state','mark_proposal_paid'
  ];
  anon_only_names text[] := ARRAY[
    'admin_get_actions_log','admin_is_super_admin_user','admin_resolve_error_report',
    'admin_retry_automation_job','admin_revenue_stats','admin_usage_stats',
    'admin_user_list','admin_user_stats','has_role','is_super_admin','automation_enabled',
    'claim_onboarding_form','lead_convert_to_client','inbound_message_ignore',
    'inbound_message_promote','onboarding_mark_reviewed','contract_countersign',
    'get_primary_custom_domain'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(internal_names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(anon_only_names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- 3) Replace always-true anonymous insert policy on landing_events with a validated one
DROP POLICY IF EXISTS "Anyone can record landing events" ON public.landing_events;
CREATE POLICY "Anyone can record valid landing events"
ON public.landing_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event IS NOT NULL
  AND length(event) BETWEEN 1 AND 100
  AND length(coalesce(path, '')) <= 500
  AND length(coalesce(referrer, '')) <= 1000
  AND length(coalesce(session_id, '')) <= 100
  AND pg_column_size(meta) <= 4096
);