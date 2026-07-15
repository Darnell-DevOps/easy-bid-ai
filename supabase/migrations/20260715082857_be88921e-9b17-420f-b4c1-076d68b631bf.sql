
-- Replace the plain unique index with a soft-delete-aware partial unique index
DROP INDEX IF EXISTS public.idx_onboarding_forms_proposal;

CREATE UNIQUE INDEX onboarding_forms_one_per_proposal
  ON public.onboarding_forms (proposal_id)
  WHERE deleted_at IS NULL AND proposal_id IS NOT NULL;

-- Atomic claim: create exactly one active onboarding form per proposal, or return the existing one.
CREATE OR REPLACE FUNCTION public.claim_onboarding_form(_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_is_new boolean;
BEGIN
  IF _proposal_id IS NULL THEN
    RETURN jsonb_build_object('form_id', NULL, 'is_new', false);
  END IF;

  INSERT INTO public.onboarding_forms (
    user_id, proposal_id, client_id, client_name, client_email, service_type, status
  )
  SELECT
    p.user_id,
    p.id,
    p.client_id,
    p.client_name,
    (SELECT email FROM public.clients WHERE id = p.client_id),
    p.service_type,
    'pending'
  FROM public.proposals p
  WHERE p.id = _proposal_id
  ON CONFLICT (proposal_id) WHERE deleted_at IS NULL AND proposal_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_is_new := true;
  ELSE
    SELECT id INTO v_id
      FROM public.onboarding_forms
     WHERE proposal_id = _proposal_id
       AND deleted_at IS NULL
     LIMIT 1;
    v_is_new := false;
  END IF;

  RETURN jsonb_build_object('form_id', v_id, 'is_new', v_is_new);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_onboarding_form(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_onboarding_form(uuid) TO service_role;

-- Rewrite automations_handle_payment_event WITHOUT any onboarding_forms creation.
CREATE OR REPLACE FUNCTION public.automations_handle_payment_event(
  _user_id uuid,
  _kind text,
  _proposal_id uuid DEFAULT NULL,
  _retainer_id uuid DEFAULT NULL,
  _amount_cents int DEFAULT 0,
  _currency text DEFAULT 'USD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text;
  v_did jsonb := '{}'::jsonb;
BEGIN
  IF _kind = 'proposal_paid' AND _proposal_id IS NOT NULL THEN
    SELECT p.client_name
      INTO v_client_name
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

    -- Onboarding form creation now happens exclusively in the payments-webhook
    -- edge function via public.claim_onboarding_form. Do not touch onboarding_forms here.
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
$$;

REVOKE EXECUTE ON FUNCTION public.automations_handle_payment_event(uuid,text,uuid,uuid,int,text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automations_handle_payment_event(uuid,text,uuid,uuid,int,text) TO service_role;
