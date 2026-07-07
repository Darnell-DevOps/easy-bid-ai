CREATE OR REPLACE FUNCTION public.automations_handle_payment_event(_user_id uuid, _kind text, _proposal_id uuid DEFAULT NULL::uuid, _retainer_id uuid DEFAULT NULL::uuid, _amount_cents integer DEFAULT 0, _currency text DEFAULT 'USD'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name text;
  v_client_email text;
  v_form_exists boolean;
  v_did jsonb := '{}'::jsonb;
  -- NOTE: keep this literal in sync with BASE_FIELDS in src/lib/onboarding.ts
  -- until we unify onboarding field templates into one source of truth.
  v_base_fields jsonb := '[
    {"id":"business_name","label":"Business name","type":"short_text","required":true,"group":"About your business"},
    {"id":"project_goals","label":"Top project goals","type":"long_text","required":true,"placeholder":"What does success look like?","group":"About your business"},
    {"id":"target_audience","label":"Target audience","type":"long_text","placeholder":"Who are we trying to reach?","group":"About your business"},
    {"id":"preferred_deadline","label":"Preferred deadline","type":"date","group":"Timing"},
    {"id":"brand_preferences","label":"Brand preferences","type":"long_text","placeholder":"Tone, vibe, colours, fonts you love","group":"Brand"},
    {"id":"important_links","label":"Important links","type":"long_text","placeholder":"Website, socials, references — one per line","group":"Resources"},
    {"id":"assets_required","label":"Assets you''ll provide","type":"long_text","placeholder":"Logos, photos, copy, videos…","group":"Resources"},
    {"id":"login_access","label":"How can we get access?","type":"long_text","placeholder":"e.g. invite us as a collaborator/admin on your platform, or let us know how you''d like to share access — please don''t type passwords here.","group":"Resources"},
    {"id":"extra_notes","label":"Anything else we should know?","type":"long_text","group":"Notes"}
  ]'::jsonb;
BEGIN
  IF _kind = 'proposal_paid' AND _proposal_id IS NOT NULL THEN
    SELECT p.client_name,
           (SELECT email FROM public.clients WHERE id = p.client_id)
      INTO v_client_name, v_client_email
      FROM public.proposals p WHERE p.id = _proposal_id;

    IF public.automation_enabled(_user_id, 'payment_notify_received') THEN
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'payment', 'payment_received',
              'Payment received',
              'Received ' || (_amount_cents::numeric / 100)::text || ' ' || _currency || ' from ' || COALESCE(v_client_name,'a client'),
              jsonb_build_object('proposal_id', _proposal_id, 'amount_cents', _amount_cents, 'currency', _currency));
      v_did := v_did || jsonb_build_object('payment_notify_received', true);
    END IF;

    IF public.automation_enabled(_user_id, 'payment_auto_confirmation') THEN
      v_did := v_did || jsonb_build_object('payment_auto_confirmation', true);
    END IF;

    IF public.automation_enabled(_user_id, 'onboarding_auto_send') THEN
      SELECT EXISTS (
        SELECT 1 FROM public.onboarding_forms WHERE proposal_id = _proposal_id
      ) INTO v_form_exists;
      IF NOT v_form_exists THEN
        INSERT INTO public.onboarding_forms (
          user_id, proposal_id,
          client_id, client_name, client_email,
          status, sent_at, fields
        )
        SELECT p.user_id, p.id, p.client_id, p.client_name, v_client_email, 'pending', now(), v_base_fields
          FROM public.proposals p WHERE p.id = _proposal_id;
        v_did := v_did || jsonb_build_object('onboarding_auto_send', true);
      END IF;
    END IF;

    IF public.automation_enabled(_user_id, 'onboarding_auto_task') THEN
      INSERT INTO public.deadlines (
        user_id, title, due_date, source, source_key, proposal_id, client_name
      ) VALUES (
        _user_id,
        'Kickoff onboarding — ' || COALESCE(v_client_name,'Client'),
        (now() + interval '3 days')::date,
        'onboarding_task',
        'onbtask-' || _proposal_id::text,
        _proposal_id, v_client_name
      ) ON CONFLICT (user_id, source_key) DO NOTHING;
      v_did := v_did || jsonb_build_object('onboarding_auto_task', true);
    END IF;

  ELSIF _kind = 'retainer_paid' AND _retainer_id IS NOT NULL THEN
    SELECT client_name INTO v_client_name FROM public.retainers WHERE id = _retainer_id;
    IF public.automation_enabled(_user_id, 'payment_notify_received') THEN
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'payment', 'payment_received',
              'Retainer payment received',
              'Received ' || (_amount_cents::numeric / 100)::text || ' ' || _currency || ' from ' || COALESCE(v_client_name,'a client'),
              jsonb_build_object('retainer_id', _retainer_id));
      v_did := v_did || jsonb_build_object('payment_notify_received', true);
    END IF;

  ELSIF _kind IN ('proposal_failed') AND _proposal_id IS NOT NULL THEN
    IF public.automation_enabled(_user_id, 'payment_notify_failed') THEN
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'payment', 'payment_failed',
              'Payment failed',
              'A client payment failed. Reach out before the lead goes cold.',
              jsonb_build_object('proposal_id', _proposal_id));
      v_did := v_did || jsonb_build_object('payment_notify_failed', true);
    END IF;

  ELSIF _kind = 'retainer_failed' AND _retainer_id IS NOT NULL THEN
    SELECT client_name INTO v_client_name FROM public.retainers WHERE id = _retainer_id;
    IF public.automation_enabled(_user_id, 'retainer_notify_failed') THEN
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'retainer', 'retainer_payment_failed',
              'Retainer payment failed',
              'A recurring payment for ' || COALESCE(v_client_name,'a client') || ' failed.',
              jsonb_build_object('retainer_id', _retainer_id));
      v_did := v_did || jsonb_build_object('retainer_notify_failed', true);
    END IF;
  END IF;

  RETURN v_did;
END;
$function$;

UPDATE public.onboarding_forms
SET fields = '[
    {"id":"business_name","label":"Business name","type":"short_text","required":true,"group":"About your business"},
    {"id":"project_goals","label":"Top project goals","type":"long_text","required":true,"placeholder":"What does success look like?","group":"About your business"},
    {"id":"target_audience","label":"Target audience","type":"long_text","placeholder":"Who are we trying to reach?","group":"About your business"},
    {"id":"preferred_deadline","label":"Preferred deadline","type":"date","group":"Timing"},
    {"id":"brand_preferences","label":"Brand preferences","type":"long_text","placeholder":"Tone, vibe, colours, fonts you love","group":"Brand"},
    {"id":"important_links","label":"Important links","type":"long_text","placeholder":"Website, socials, references — one per line","group":"Resources"},
    {"id":"assets_required","label":"Assets you''ll provide","type":"long_text","placeholder":"Logos, photos, copy, videos…","group":"Resources"},
    {"id":"login_access","label":"How can we get access?","type":"long_text","placeholder":"e.g. invite us as a collaborator/admin on your platform, or let us know how you''d like to share access — please don''t type passwords here.","group":"Resources"},
    {"id":"extra_notes","label":"Anything else we should know?","type":"long_text","group":"Notes"}
  ]'::jsonb
WHERE id IN ('9698a68c-2081-4fb6-bba4-14dfe84c44bd','6cfb66b2-1aab-4c5c-abc3-2f6f11bc8353');