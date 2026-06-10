
CREATE OR REPLACE FUNCTION public.automations_test_all(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  marker text := 'autotest-' || replace(gen_random_uuid()::text, '-', '');
  results jsonb := '{}'::jsonb;
  v_orig_prefs jsonb;
  v_client_id uuid;
  v_prop_id uuid;
  v_contract_id uuid;
  v_retainer_id uuid;
  v_form_id uuid;
  v_deadline_id uuid;
  v_count int;
  v_pass boolean;
  v_token text;

  PROC_SET CONSTANT text := '';
BEGIN
  -- Snapshot user's current prefs and clear them so we control each toggle explicitly
  SELECT preferences INTO v_orig_prefs FROM public.automation_preferences WHERE user_id = _user_id;
  INSERT INTO public.automation_preferences (user_id, preferences)
  VALUES (_user_id, '{}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET preferences = '{}'::jsonb;

  -- Test client
  INSERT INTO public.clients (user_id, name, email, company)
  VALUES (_user_id, marker || '-client', marker || '@test.local', marker)
  RETURNING id INTO v_client_id;

  ------------------------------------------------------------------
  -- helper: set a single toggle
  -- using a DO-block is unwieldy, so we inline UPDATE calls
  ------------------------------------------------------------------

  ------------------ PROPOSALS ------------------

  -- proposal_auto_send: on => proposal inserted as 'draft' is auto-marked sent
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_auto_send', true) WHERE user_id = _user_id;
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, status)
  VALUES (_user_id, v_client_id, marker || '-p1', marker, 'draft') RETURNING id INTO v_prop_id;
  SELECT count(*) INTO v_count FROM public.proposals WHERE id = v_prop_id AND status = 'sent' AND sent_at IS NOT NULL;
  v_pass := v_count = 1;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_auto_send', false) WHERE user_id = _user_id;
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, status)
  VALUES (_user_id, v_client_id, marker || '-p2', marker, 'draft') RETURNING id INTO v_prop_id;
  SELECT count(*) INTO v_count FROM public.proposals WHERE id = v_prop_id AND status = 'draft';
  results := results || jsonb_build_object('proposal_auto_send', v_pass AND v_count = 1);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- proposal_follow_up: creates a deadline with source='proposal_follow_up'
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_follow_up', true) WHERE user_id = _user_id;
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope)
  VALUES (_user_id, v_client_id, marker || '-pfu1', marker) RETURNING id INTO v_prop_id;
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'proposal_follow_up';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE proposal_id = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_follow_up', false) WHERE user_id = _user_id;
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope)
  VALUES (_user_id, v_client_id, marker || '-pfu2', marker) RETURNING id INTO v_prop_id;
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'proposal_follow_up';
  results := results || jsonb_build_object('proposal_follow_up', v_pass AND v_count = 0);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- proposal_create_deadline (requires timeline)
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_create_deadline', true) WHERE user_id = _user_id;
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, timeline)
  VALUES (_user_id, v_client_id, marker || '-pcd1', marker, '30 days') RETURNING id INTO v_prop_id;
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'proposal_timeline';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE proposal_id = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_create_deadline', false) WHERE user_id = _user_id;
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, timeline)
  VALUES (_user_id, v_client_id, marker || '-pcd2', marker, '30 days') RETURNING id INTO v_prop_id;
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'proposal_timeline';
  results := results || jsonb_build_object('proposal_create_deadline', v_pass AND v_count = 0);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- proposal_notify_viewed: update viewed_at => notification created
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope)
  VALUES (_user_id, v_client_id, marker || '-pnv', marker) RETURNING id INTO v_prop_id;

  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_notify_viewed', true) WHERE user_id = _user_id;
  UPDATE public.proposals SET viewed_at = now() WHERE id = v_prop_id;
  SELECT count(*) INTO v_count FROM public.user_notifications
   WHERE user_id = _user_id AND key = 'proposal_viewed' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope)
  VALUES (_user_id, v_client_id, marker || '-pnv2', marker) RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_notify_viewed', false) WHERE user_id = _user_id;
  UPDATE public.proposals SET viewed_at = now() WHERE id = v_prop_id;
  SELECT count(*) INTO v_count FROM public.user_notifications
   WHERE user_id = _user_id AND key = 'proposal_viewed' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  results := results || jsonb_build_object('proposal_notify_viewed', v_pass AND v_count = 0);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- proposal_notify_expired (via tick)
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, status, sent_at)
  VALUES (_user_id, v_client_id, marker || '-pex', marker, 'sent', now() - interval '20 days')
  RETURNING id INTO v_prop_id;

  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_notify_expired', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications
   WHERE key = 'proposal_expired' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;

  UPDATE public.automation_preferences SET preferences = jsonb_build_object('proposal_notify_expired', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications
   WHERE key = 'proposal_expired' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  results := results || jsonb_build_object('proposal_notify_expired', v_pass AND v_count = 0);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  ------------------ CONTRACTS (via client_portal_respond + contract_sign) ------------------

  -- contract_auto_generate
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, amount_cents, currency, status)
  VALUES (_user_id, v_client_id, marker || '-pcag', marker, 50000, 'USD', 'sent') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_auto_generate', true) WHERE user_id = _user_id;
  PERFORM public.client_portal_respond(v_prop_id, 'accept', NULL);
  SELECT count(*) INTO v_count FROM public.contracts WHERE proposal_id = v_prop_id;
  v_pass := v_count = 1;
  DELETE FROM public.contracts WHERE proposal_id = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, amount_cents, currency, status)
  VALUES (_user_id, v_client_id, marker || '-pcag2', marker, 50000, 'USD', 'sent') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_auto_generate', false) WHERE user_id = _user_id;
  PERFORM public.client_portal_respond(v_prop_id, 'accept', NULL);
  SELECT count(*) INTO v_count FROM public.contracts WHERE proposal_id = v_prop_id;
  results := results || jsonb_build_object('contract_auto_generate', v_pass AND v_count = 0);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- contract_auto_send (requires contract_auto_generate=true; checks contract status)
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, amount_cents, currency, status)
  VALUES (_user_id, v_client_id, marker || '-pcas', marker, 50000, 'USD', 'sent') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_auto_generate', true, 'contract_auto_send', true) WHERE user_id = _user_id;
  PERFORM public.client_portal_respond(v_prop_id, 'accept', NULL);
  SELECT count(*) INTO v_count FROM public.contracts WHERE proposal_id = v_prop_id AND status = 'sent' AND sent_at IS NOT NULL;
  v_pass := v_count = 1;
  DELETE FROM public.contracts WHERE proposal_id = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, amount_cents, currency, status)
  VALUES (_user_id, v_client_id, marker || '-pcas2', marker, 50000, 'USD', 'sent') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_auto_generate', true, 'contract_auto_send', false) WHERE user_id = _user_id;
  PERFORM public.client_portal_respond(v_prop_id, 'accept', NULL);
  SELECT count(*) INTO v_count FROM public.contracts WHERE proposal_id = v_prop_id AND status = 'draft';
  results := results || jsonb_build_object('contract_auto_send', v_pass AND v_count = 1);
  DELETE FROM public.contracts WHERE proposal_id = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- contract_follow_up: pre-create a deadline source='contract_follow_up' then sign => resolved
  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-cfu', 'service_agreement', marker, 'body', 10000, 'USD', 'sent', marker || '-tok1')
  RETURNING id INTO v_contract_id;
  INSERT INTO public.deadlines (user_id, contract_id, client_name, title, due_date, source, source_key)
  VALUES (_user_id, v_contract_id, marker, 'CFU', current_date, 'contract_follow_up', 'cfu-' || v_contract_id::text);
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_follow_up', true) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok1', 'Signer', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE contract_id = v_contract_id AND source = 'contract_follow_up' AND status = 'done';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-cfu2', 'service_agreement', marker, 'body', 10000, 'USD', 'sent', marker || '-tok2')
  RETURNING id INTO v_contract_id;
  INSERT INTO public.deadlines (user_id, contract_id, client_name, title, due_date, source, source_key)
  VALUES (_user_id, v_contract_id, marker, 'CFU', current_date, 'contract_follow_up', 'cfu-' || v_contract_id::text);
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_follow_up', false) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok2', 'Signer', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE contract_id = v_contract_id AND source = 'contract_follow_up' AND status = 'done';
  results := results || jsonb_build_object('contract_follow_up', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  -- contract_notify_signed
  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-cns', 'service_agreement', marker, 'body', 10000, 'USD', 'sent', marker || '-tok3')
  RETURNING id INTO v_contract_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_notify_signed', true) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok3', 'Signer', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'contract_signed' AND (metadata->>'contract_id')::uuid = v_contract_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'contract_id')::uuid = v_contract_id;
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-cns2', 'service_agreement', marker, 'body', 10000, 'USD', 'sent', marker || '-tok4')
  RETURNING id INTO v_contract_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('contract_notify_signed', false) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok4', 'Signer', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'contract_signed' AND (metadata->>'contract_id')::uuid = v_contract_id;
  results := results || jsonb_build_object('contract_notify_signed', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  ------------------ PAYMENTS (deadlines + notifications) ------------------

  -- payment_auto_request: contract sign creates a 'payment_request' deadline
  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-par', 'service_agreement', marker, 'body', 50000, 'USD', 'sent', marker || '-tok5')
  RETURNING id INTO v_contract_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_auto_request', true) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok5', 'Signer', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE contract_id = v_contract_id AND source = 'payment_request';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.user_notifications WHERE (metadata->>'contract_id')::uuid = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-par2', 'service_agreement', marker, 'body', 50000, 'USD', 'sent', marker || '-tok6')
  RETURNING id INTO v_contract_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_auto_request', false) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok6', 'Signer', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE contract_id = v_contract_id AND source = 'payment_request';
  results := results || jsonb_build_object('payment_auto_request', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.user_notifications WHERE (metadata->>'contract_id')::uuid = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  -- payment_auto_confirmation (intent returned by automations_handle_payment_event)
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, amount_cents, currency)
  VALUES (_user_id, v_client_id, marker || '-pac', marker, 1000, 'USD') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_auto_confirmation', true) WHERE user_id = _user_id;
  v_pass := (public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD') ->> 'payment_auto_confirmation')::boolean IS TRUE;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_auto_confirmation', false) WHERE user_id = _user_id;
  results := results || jsonb_build_object('payment_auto_confirmation',
    v_pass AND COALESCE((public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD') ->> 'payment_auto_confirmation'), 'false') = 'false');
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- payment_notify_received
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, amount_cents, currency)
  VALUES (_user_id, v_client_id, marker || '-pnr', marker, 1000, 'USD') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_notify_received', true) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'payment_received' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  v_pass := v_count >= 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_notify_received', false) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'payment_received' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  results := results || jsonb_build_object('payment_notify_received', v_pass AND v_count = 0);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- payment_notify_failed
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope)
  VALUES (_user_id, v_client_id, marker || '-pnf', marker) RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_notify_failed', true) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_failed', v_prop_id, NULL, 0, 'USD');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'payment_failed' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_notify_failed', false) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_failed', v_prop_id, NULL, 0, 'USD');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'payment_failed' AND (metadata->>'proposal_id')::uuid = v_prop_id;
  results := results || jsonb_build_object('payment_notify_failed', v_pass AND v_count = 0);
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- payment_follow_up_unpaid (via tick on overdue retainer invoice)
  INSERT INTO public.retainers (user_id, client_id, client_name, service_type, amount_cents, currency, status, billing_cycle)
  VALUES (_user_id, v_client_id, marker || '-r1', marker, 10000, 'USD', 'active', 'monthly') RETURNING id INTO v_retainer_id;
  INSERT INTO public.retainer_invoices (user_id, retainer_id, amount_cents, currency, due_date, status)
  VALUES (_user_id, v_retainer_id, 10000, 'USD', current_date - 10, 'scheduled');
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_follow_up_unpaid', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.deadlines WHERE user_id = _user_id AND source = 'invoice_followup' AND client_name = marker || '-r1';
  v_pass := v_count >= 1;
  DELETE FROM public.deadlines WHERE user_id = _user_id AND source = 'invoice_followup' AND client_name = marker || '-r1';
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('payment_follow_up_unpaid', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.deadlines WHERE user_id = _user_id AND source = 'invoice_followup' AND client_name = marker || '-r1';
  results := results || jsonb_build_object('payment_follow_up_unpaid', v_pass AND v_count = 0);

  ------------------ ONBOARDING ------------------

  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, amount_cents, currency)
  VALUES (_user_id, v_client_id, marker || '-onb', marker, 1000, 'USD') RETURNING id INTO v_prop_id;

  -- onboarding_auto_send
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_auto_send', true) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD');
  SELECT count(*) INTO v_count FROM public.onboarding_forms WHERE proposal_id = v_prop_id;
  v_pass := v_count = 1;
  DELETE FROM public.onboarding_forms WHERE proposal_id = v_prop_id;
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_auto_send', false) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD');
  SELECT count(*) INTO v_count FROM public.onboarding_forms WHERE proposal_id = v_prop_id;
  results := results || jsonb_build_object('onboarding_auto_send', v_pass AND v_count = 0);
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;

  -- onboarding_auto_task
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_auto_task', true) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'onboarding_task';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE proposal_id = v_prop_id;
  DELETE FROM public.onboarding_forms WHERE proposal_id = v_prop_id;
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_auto_task', false) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'proposal_paid', v_prop_id, NULL, 1000, 'USD');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'onboarding_task';
  results := results || jsonb_build_object('onboarding_auto_task', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE proposal_id = v_prop_id;
  DELETE FROM public.onboarding_forms WHERE proposal_id = v_prop_id;
  DELETE FROM public.user_notifications WHERE (metadata->>'proposal_id')::uuid = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- onboarding_notify_completed (via onboarding_submit)
  INSERT INTO public.onboarding_forms (user_id, client_id, client_name, access_token, status)
  VALUES (_user_id, v_client_id, marker, marker || '-fk1', 'pending') RETURNING id INTO v_form_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_notify_completed', true) WHERE user_id = _user_id;
  PERFORM public.onboarding_submit(marker || '-fk1', '{}'::jsonb, true);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'onboarding_completed' AND (metadata->>'onboarding_form_id')::uuid = v_form_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'onboarding_form_id')::uuid = v_form_id;
  DELETE FROM public.onboarding_forms WHERE id = v_form_id;

  INSERT INTO public.onboarding_forms (user_id, client_id, client_name, access_token, status)
  VALUES (_user_id, v_client_id, marker, marker || '-fk2', 'pending') RETURNING id INTO v_form_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_notify_completed', false) WHERE user_id = _user_id;
  PERFORM public.onboarding_submit(marker || '-fk2', '{}'::jsonb, true);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'onboarding_completed' AND (metadata->>'onboarding_form_id')::uuid = v_form_id;
  results := results || jsonb_build_object('onboarding_notify_completed', v_pass AND v_count = 0);
  DELETE FROM public.onboarding_forms WHERE id = v_form_id;

  -- onboarding_remind_client (tick updates reminded_at)
  INSERT INTO public.onboarding_forms (user_id, client_id, client_name, access_token, status, sent_at)
  VALUES (_user_id, v_client_id, marker, marker || '-fk3', 'pending', now() - interval '5 days') RETURNING id INTO v_form_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_remind_client', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.onboarding_forms WHERE id = v_form_id AND reminded_at IS NOT NULL;
  v_pass := v_count = 1;
  DELETE FROM public.onboarding_forms WHERE id = v_form_id;

  INSERT INTO public.onboarding_forms (user_id, client_id, client_name, access_token, status, sent_at)
  VALUES (_user_id, v_client_id, marker, marker || '-fk4', 'pending', now() - interval '5 days') RETURNING id INTO v_form_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('onboarding_remind_client', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.onboarding_forms WHERE id = v_form_id AND reminded_at IS NULL;
  results := results || jsonb_build_object('onboarding_remind_client', v_pass AND v_count = 1);
  DELETE FROM public.onboarding_forms WHERE id = v_form_id;

  ------------------ RETAINERS (tick-based) ------------------
  UPDATE public.retainers SET next_billing_date = current_date + 2 WHERE id = v_retainer_id;

  -- retainer_renewal_reminder
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_renewal_reminder', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.deadlines WHERE retainer_id = v_retainer_id AND source = 'retainer_renewal';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE retainer_id = v_retainer_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_renewal_reminder', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.deadlines WHERE retainer_id = v_retainer_id AND source = 'retainer_renewal';
  results := results || jsonb_build_object('retainer_renewal_reminder', v_pass AND v_count = 0);

  -- retainer_notify_before_renewal
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_notify_before_renewal', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'retainer_renewing' AND (metadata->>'retainer_id')::uuid = v_retainer_id;
  v_pass := v_count >= 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'retainer_id')::uuid = v_retainer_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_notify_before_renewal', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'retainer_renewing' AND (metadata->>'retainer_id')::uuid = v_retainer_id;
  results := results || jsonb_build_object('retainer_notify_before_renewal', v_pass AND v_count = 0);

  -- retainer_notify_failed (payment event)
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_notify_failed', true) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'retainer_failed', NULL, v_retainer_id, 0, 'USD');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'retainer_payment_failed' AND (metadata->>'retainer_id')::uuid = v_retainer_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'retainer_id')::uuid = v_retainer_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_notify_failed', false) WHERE user_id = _user_id;
  PERFORM public.automations_handle_payment_event(_user_id, 'retainer_failed', NULL, v_retainer_id, 0, 'USD');
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'retainer_payment_failed' AND (metadata->>'retainer_id')::uuid = v_retainer_id;
  results := results || jsonb_build_object('retainer_notify_failed', v_pass AND v_count = 0);

  -- retainer_generate_proposal_draft
  UPDATE public.retainers SET next_billing_date = current_date + 10 WHERE id = v_retainer_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_generate_proposal_draft', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.proposals WHERE client_id = v_client_id AND notes LIKE '%retainer-renewal-draft%';
  v_pass := v_count >= 1;
  DELETE FROM public.proposals WHERE client_id = v_client_id AND notes LIKE '%retainer-renewal-draft%';
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('retainer_generate_proposal_draft', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.proposals WHERE client_id = v_client_id AND notes LIKE '%retainer-renewal-draft%';
  results := results || jsonb_build_object('retainer_generate_proposal_draft', v_pass AND v_count = 0);

  ------------------ DEADLINES ------------------

  -- deadlines_from_contracts (contract_sign)
  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-dfc', 'service_agreement', marker, 'body', 0, 'USD', 'sent', marker || '-tok7')
  RETURNING id INTO v_contract_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_from_contracts', true) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok7', 'S', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE contract_id = v_contract_id AND source = 'contract_signed';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  INSERT INTO public.contracts (user_id, client_id, client_name, contract_type, title, body, amount_cents, currency, status, signing_token)
  VALUES (_user_id, v_client_id, marker || '-dfc2', 'service_agreement', marker, 'body', 0, 'USD', 'sent', marker || '-tok8')
  RETURNING id INTO v_contract_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_from_contracts', false) WHERE user_id = _user_id;
  PERFORM public.contract_sign(marker || '-tok8', 'S', 'a@b.com', 'typed', 'sig', '1.1.1.1', 'ua');
  SELECT count(*) INTO v_count FROM public.deadlines WHERE contract_id = v_contract_id AND source = 'contract_signed';
  results := results || jsonb_build_object('deadlines_from_contracts', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE contract_id = v_contract_id;
  DELETE FROM public.contract_signatures WHERE contract_id = v_contract_id;
  DELETE FROM public.contracts WHERE id = v_contract_id;

  -- deadlines_from_proposals (client_portal_respond accept with timeline)
  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, timeline, status)
  VALUES (_user_id, v_client_id, marker || '-dfp', marker, '30 days', 'sent') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_from_proposals', true) WHERE user_id = _user_id;
  PERFORM public.client_portal_respond(v_prop_id, 'accept', NULL);
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'proposal_accepted';
  v_pass := v_count = 1;
  DELETE FROM public.deadlines WHERE proposal_id = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  INSERT INTO public.proposals (user_id, client_id, client_name, project_scope, timeline, status)
  VALUES (_user_id, v_client_id, marker || '-dfp2', marker, '30 days', 'sent') RETURNING id INTO v_prop_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_from_proposals', false) WHERE user_id = _user_id;
  PERFORM public.client_portal_respond(v_prop_id, 'accept', NULL);
  SELECT count(*) INTO v_count FROM public.deadlines WHERE proposal_id = v_prop_id AND source = 'proposal_accepted';
  results := results || jsonb_build_object('deadlines_from_proposals', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE proposal_id = v_prop_id;
  DELETE FROM public.proposals WHERE id = v_prop_id;

  -- deadlines_notify_before (deadline due in 3 days)
  INSERT INTO public.deadlines (user_id, title, due_date, source, source_key)
  VALUES (_user_id, marker || '-dnb', current_date + 3, 'manual', marker || '-dnb-k') RETURNING id INTO v_deadline_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_notify_before', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'deadline_upcoming' AND (metadata->>'deadline_id')::uuid = v_deadline_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'deadline_id')::uuid = v_deadline_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_notify_before', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'deadline_upcoming' AND (metadata->>'deadline_id')::uuid = v_deadline_id;
  results := results || jsonb_build_object('deadlines_notify_before', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE id = v_deadline_id;

  -- deadlines_notify_overdue
  INSERT INTO public.deadlines (user_id, title, due_date, source, source_key)
  VALUES (_user_id, marker || '-dno', current_date - 2, 'manual', marker || '-dno-k') RETURNING id INTO v_deadline_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_notify_overdue', true) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'deadline_overdue' AND (metadata->>'deadline_id')::uuid = v_deadline_id;
  v_pass := v_count = 1;
  DELETE FROM public.user_notifications WHERE (metadata->>'deadline_id')::uuid = v_deadline_id;
  UPDATE public.automation_preferences SET preferences = jsonb_build_object('deadlines_notify_overdue', false) WHERE user_id = _user_id;
  PERFORM public.automations_run_user_ticks(_user_id);
  SELECT count(*) INTO v_count FROM public.user_notifications WHERE key = 'deadline_overdue' AND (metadata->>'deadline_id')::uuid = v_deadline_id;
  results := results || jsonb_build_object('deadlines_notify_overdue', v_pass AND v_count = 0);
  DELETE FROM public.deadlines WHERE id = v_deadline_id;

  ------------------ CLEANUP ------------------
  DELETE FROM public.retainer_invoices WHERE retainer_id = v_retainer_id;
  DELETE FROM public.retainers WHERE id = v_retainer_id;
  DELETE FROM public.deadlines WHERE user_id = _user_id AND (client_name = marker OR title LIKE marker || '%' OR source_key LIKE marker || '%');
  DELETE FROM public.user_notifications WHERE user_id = _user_id AND body LIKE '%' || marker || '%';
  DELETE FROM public.clients WHERE id = v_client_id;

  -- Restore original prefs
  IF v_orig_prefs IS NULL THEN
    DELETE FROM public.automation_preferences WHERE user_id = _user_id;
  ELSE
    UPDATE public.automation_preferences SET preferences = v_orig_prefs WHERE user_id = _user_id;
  END IF;

  RETURN results;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.automations_test_all(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automations_test_all(uuid) TO service_role;
