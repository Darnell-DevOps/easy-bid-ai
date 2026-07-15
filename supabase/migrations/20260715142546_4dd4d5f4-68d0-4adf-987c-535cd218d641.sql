
CREATE OR REPLACE FUNCTION public.automations_handle_payment_event(_user_id uuid, _kind text, _proposal_id uuid DEFAULT NULL::uuid, _retainer_id uuid DEFAULT NULL::uuid, _amount_cents integer DEFAULT 0, _currency text DEFAULT 'USD'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name text;
  v_did jsonb := '{}'::jsonb;
BEGIN
  IF _kind = 'proposal_paid' AND _proposal_id IS NOT NULL THEN
    SELECT p.client_name INTO v_client_name FROM public.proposals p WHERE p.id = _proposal_id;

    IF public.automation_enabled(_user_id, 'payment_notify_received') THEN
      -- Dedup key encodes proposal id so duplicate webhook deliveries collapse,
      -- while distinct proposals still each get their own notification.
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'payment',
              'payment_received-proposal-' || _proposal_id::text,
              'Payment received',
              'Received ' || (_amount_cents::numeric / 100)::text || ' ' || _currency || ' from ' || COALESCE(v_client_name,'a client'),
              jsonb_build_object('proposal_id', _proposal_id, 'amount_cents', _amount_cents, 'currency', _currency))
      ON CONFLICT (user_id, key) WHERE category IN ('payment','retainer') DO NOTHING;
      v_did := v_did || jsonb_build_object('payment_notify_received', true);
    END IF;

    IF public.automation_enabled(_user_id, 'payment_auto_confirmation') THEN
      v_did := v_did || jsonb_build_object('payment_auto_confirmation', true);
    END IF;

    IF public.automation_enabled(_user_id, 'onboarding_auto_send') THEN
      v_did := v_did || jsonb_build_object('onboarding_auto_send', true);
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
      -- Retainers renew repeatedly; each real charge deserves its own notification.
      -- Bucket by UTC date + amount so a same-day webhook retry dedupes but a genuine
      -- next-cycle charge (different day, or different amount) produces a new key.
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'payment',
              'payment_received-retainer-' || _retainer_id::text
                || '-' || to_char((now() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
                || '-' || _amount_cents::text,
              'Retainer payment received',
              'Received ' || (_amount_cents::numeric / 100)::text || ' ' || _currency || ' from ' || COALESCE(v_client_name,'a client'),
              jsonb_build_object('retainer_id', _retainer_id))
      ON CONFLICT (user_id, key) WHERE category IN ('payment','retainer') DO NOTHING;
      v_did := v_did || jsonb_build_object('payment_notify_received', true);
    END IF;

  ELSIF _kind IN ('proposal_failed') AND _proposal_id IS NOT NULL THEN
    IF public.automation_enabled(_user_id, 'payment_notify_failed') THEN
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'payment', 'payment_failed-proposal-' || _proposal_id::text,
              'Payment failed',
              'A client payment failed. Reach out before the lead goes cold.',
              jsonb_build_object('proposal_id', _proposal_id))
      ON CONFLICT (user_id, key) WHERE category IN ('payment','retainer') DO NOTHING;
      v_did := v_did || jsonb_build_object('payment_notify_failed', true);
    END IF;

  ELSIF _kind = 'retainer_failed' AND _retainer_id IS NOT NULL THEN
    SELECT client_name INTO v_client_name FROM public.retainers WHERE id = _retainer_id;
    IF public.automation_enabled(_user_id, 'retainer_notify_failed') THEN
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'retainer',
              'retainer_payment_failed-' || _retainer_id::text
                || '-' || to_char((now() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD'),
              'Retainer payment failed',
              'A recurring payment for ' || COALESCE(v_client_name,'a client') || ' failed.',
              jsonb_build_object('retainer_id', _retainer_id))
      ON CONFLICT (user_id, key) WHERE category IN ('payment','retainer') DO NOTHING;
      v_did := v_did || jsonb_build_object('retainer_notify_failed', true);
    END IF;
  END IF;

  RETURN v_did;
END;
$function$;
