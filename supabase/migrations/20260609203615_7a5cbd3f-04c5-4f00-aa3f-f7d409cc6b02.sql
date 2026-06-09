
-- ============================================================
-- AUTOMATIONS WIRING — Foundation
-- ============================================================

-- 1) Helper: read a single automation toggle with sane defaults
CREATE OR REPLACE FUNCTION public.automation_enabled(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val boolean;
  v_default boolean;
BEGIN
  SELECT (preferences ->> _key)::boolean INTO v_val
    FROM public.automation_preferences
   WHERE user_id = _user_id;

  IF v_val IS NOT NULL THEN
    RETURN v_val;
  END IF;

  -- Defaults mirror src/components/settings/AutomationsSettings.tsx defaultOn values
  v_default := CASE _key
    WHEN 'proposal_auto_send' THEN false
    WHEN 'proposal_follow_up' THEN true
    WHEN 'proposal_create_deadline' THEN true
    WHEN 'proposal_notify_viewed' THEN true
    WHEN 'proposal_notify_expired' THEN true
    WHEN 'contract_auto_generate' THEN true
    WHEN 'contract_auto_send' THEN false
    WHEN 'contract_follow_up' THEN true
    WHEN 'contract_notify_signed' THEN true
    WHEN 'payment_auto_request' THEN true
    WHEN 'payment_auto_confirmation' THEN true
    WHEN 'payment_notify_received' THEN true
    WHEN 'payment_notify_failed' THEN true
    WHEN 'payment_follow_up_unpaid' THEN true
    WHEN 'onboarding_auto_send' THEN true
    WHEN 'onboarding_auto_task' THEN true
    WHEN 'onboarding_notify_completed' THEN true
    WHEN 'onboarding_remind_client' THEN true
    WHEN 'retainer_renewal_reminder' THEN true
    WHEN 'retainer_notify_before_renewal' THEN true
    WHEN 'retainer_notify_failed' THEN true
    WHEN 'retainer_generate_proposal_draft' THEN false
    WHEN 'deadlines_from_contracts' THEN true
    WHEN 'deadlines_from_proposals' THEN true
    WHEN 'deadlines_notify_before' THEN true
    WHEN 'deadlines_notify_overdue' THEN true
    ELSE false
  END;

  RETURN v_default;
END;
$$;

-- 2) In-app notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  key text NOT NULL,
  title text NOT NULL,
  body text,
  link_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON public.user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx ON public.user_notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.user_notifications
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.user_notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3) Updated RPC: client_portal_respond — gate contract auto-gen / auto-send / proposal-deadlines
CREATE OR REPLACE FUNCTION public.client_portal_respond(_proposal_id uuid, _action text, _message text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prop public.proposals%ROWTYPE;
  v_contract_id uuid;
BEGIN
  IF _action NOT IN ('view','accept','reject') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT * INTO v_prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;

  IF _action = 'view' THEN
    UPDATE public.proposals
       SET viewed_at = COALESCE(viewed_at, now()),
           status = CASE WHEN status IN ('draft','sent') THEN 'viewed' ELSE status END
     WHERE id = _proposal_id;

  ELSIF _action = 'accept' THEN
    UPDATE public.proposals
       SET status = 'accepted',
           accepted_at = COALESCE(accepted_at, now()),
           rejected_at = NULL,
           client_response_message = COALESCE(_message, client_response_message)
     WHERE id = _proposal_id;

    -- contract_auto_generate
    IF public.automation_enabled(v_prop.user_id, 'contract_auto_generate') THEN
      INSERT INTO public.contracts (
        user_id, proposal_id, client_id, contract_type, title,
        client_name, company_name, body, amount_cents, currency, status,
        sent_at
      ) VALUES (
        v_prop.user_id, v_prop.id, v_prop.client_id, 'service_agreement',
        'Service Agreement — ' || COALESCE(v_prop.client_name, 'Client'),
        v_prop.client_name, v_prop.company_name, '',
        v_prop.amount_cents, COALESCE(v_prop.currency, 'USD'),
        CASE WHEN public.automation_enabled(v_prop.user_id, 'contract_auto_send') THEN 'sent' ELSE 'draft' END,
        CASE WHEN public.automation_enabled(v_prop.user_id, 'contract_auto_send') THEN now() ELSE NULL END
      ) RETURNING id INTO v_contract_id;
    END IF;

    -- deadlines_from_proposals (only if proposal has a timeline string)
    IF public.automation_enabled(v_prop.user_id, 'deadlines_from_proposals')
       AND COALESCE(v_prop.timeline, '') <> '' THEN
      INSERT INTO public.deadlines (
        user_id, title, due_date, source, source_key,
        proposal_id, client_id, client_name
      ) VALUES (
        v_prop.user_id,
        'Project milestone — ' || COALESCE(v_prop.client_name, 'Project'),
        (now() + interval '30 days')::date,
        'proposal_accepted',
        'proposal-' || v_prop.id::text,
        v_prop.id, v_prop.client_id, v_prop.client_name
      ) ON CONFLICT (user_id, source_key) DO NOTHING;
    END IF;

  ELSIF _action = 'reject' THEN
    UPDATE public.proposals
       SET status = 'rejected',
           rejected_at = COALESCE(rejected_at, now()),
           accepted_at = NULL,
           client_response_message = COALESCE(_message, client_response_message)
     WHERE id = _proposal_id;
  END IF;
END;
$$;

-- 4) Updated RPC: contract_sign — gate payment_auto_request / contract_follow_up resolve /
--    contract_notify_signed / deadlines_from_contracts
CREATE OR REPLACE FUNCTION public.contract_sign(
  _token text, _signer_name text, _signer_email text,
  _method text, _signature_data text, _ip text, _ua text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_sig_id uuid;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE signing_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid signing token'; END IF;
  IF v_contract.status = 'signed' THEN RAISE EXCEPTION 'Contract already signed'; END IF;
  IF _method NOT IN ('typed','drawn') THEN RAISE EXCEPTION 'Invalid signature method'; END IF;
  IF length(coalesce(_signer_name,'')) < 2 THEN RAISE EXCEPTION 'Signer name required'; END IF;

  INSERT INTO public.contract_signatures (
    contract_id, user_id, signer_name, signer_email, method, signature_data, ip_address, user_agent
  ) VALUES (
    v_contract.id, v_contract.user_id, _signer_name, _signer_email, _method, _signature_data, _ip, _ua
  ) RETURNING id INTO v_sig_id;

  UPDATE public.contracts
     SET status = 'signed', signed_at = now(), viewed_at = COALESCE(viewed_at, now())
   WHERE id = v_contract.id;

  -- payment_auto_request: create a payment-request deadline
  IF public.automation_enabled(v_contract.user_id, 'payment_auto_request')
     AND COALESCE(v_contract.amount_cents, 0) > 0 THEN
    INSERT INTO public.deadlines (
      user_id, title, due_date, source, source_key,
      contract_id, client_id, client_name, priority
    ) VALUES (
      v_contract.user_id,
      'Send payment request — ' || COALESCE(v_contract.client_name, 'Client'),
      (now() + interval '1 day')::date,
      'payment_request',
      'payreq-' || v_contract.id::text,
      v_contract.id, v_contract.client_id, v_contract.client_name, 'high'
    ) ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;

  -- contract_follow_up: resolve any pending "contract follow-up" deadlines
  IF public.automation_enabled(v_contract.user_id, 'contract_follow_up') THEN
    UPDATE public.deadlines
       SET status = 'done', completed_at = now()
     WHERE user_id = v_contract.user_id
       AND contract_id = v_contract.id
       AND source = 'contract_follow_up'
       AND status <> 'done';
  END IF;

  -- deadlines_from_contracts
  IF public.automation_enabled(v_contract.user_id, 'deadlines_from_contracts') THEN
    INSERT INTO public.deadlines (
      user_id, title, due_date, source, source_key,
      contract_id, client_id, client_name
    ) VALUES (
      v_contract.user_id,
      'Kickoff — ' || COALESCE(v_contract.client_name, 'Client'),
      (now() + interval '3 days')::date,
      'contract_signed',
      'kickoff-' || v_contract.id::text,
      v_contract.id, v_contract.client_id, v_contract.client_name
    ) ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;

  -- contract_notify_signed
  IF public.automation_enabled(v_contract.user_id, 'contract_notify_signed') THEN
    INSERT INTO public.user_notifications (
      user_id, category, key, title, body, metadata
    ) VALUES (
      v_contract.user_id, 'contract', 'contract_signed',
      'Contract signed',
      COALESCE(v_contract.client_name, 'A client') || ' signed ' || v_contract.title,
      jsonb_build_object('contract_id', v_contract.id, 'signer_name', _signer_name)
    );
  END IF;

  RETURN v_sig_id;
END;
$$;

-- 5) Updated RPC: onboarding_submit — gate onboarding_notify_completed
CREATE OR REPLACE FUNCTION public.onboarding_submit(_token text, _responses jsonb, _complete boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_form public.onboarding_forms%ROWTYPE;
BEGIN
  SELECT * INTO v_form FROM public.onboarding_forms WHERE access_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid onboarding token'; END IF;

  UPDATE public.onboarding_forms
     SET responses    = COALESCE(_responses, '{}'::jsonb),
         status       = CASE WHEN _complete THEN 'completed' ELSE 'in_progress' END,
         started_at   = COALESCE(started_at, now()),
         completed_at = CASE WHEN _complete THEN now() ELSE completed_at END
   WHERE id = v_form.id;

  IF _complete AND public.automation_enabled(v_form.user_id, 'onboarding_notify_completed') THEN
    INSERT INTO public.user_notifications (
      user_id, category, key, title, body, metadata
    ) VALUES (
      v_form.user_id, 'onboarding', 'onboarding_completed',
      'Onboarding completed',
      COALESCE(v_form.client_name, 'A client') || ' completed their onboarding form.',
      jsonb_build_object('onboarding_form_id', v_form.id)
    );
  END IF;

  RETURN v_form.id;
END;
$$;

-- 6) Trigger: proposals AFTER INSERT — auto_send / follow_up / create_deadline
CREATE OR REPLACE FUNCTION public.tg_proposals_after_insert_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'draft' AND public.automation_enabled(NEW.user_id, 'proposal_auto_send') THEN
    UPDATE public.proposals
       SET status = 'sent', sent_at = COALESCE(sent_at, now())
     WHERE id = NEW.id;
  END IF;

  IF public.automation_enabled(NEW.user_id, 'proposal_follow_up') THEN
    INSERT INTO public.deadlines (
      user_id, title, due_date, source, source_key,
      proposal_id, client_id, client_name, priority
    ) VALUES (
      NEW.user_id,
      'Follow up on proposal — ' || COALESCE(NEW.client_name, 'Client'),
      (now() + interval '5 days')::date,
      'proposal_follow_up',
      'pfu-' || NEW.id::text,
      NEW.id, NEW.client_id, NEW.client_name, 'medium'
    ) ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;

  IF public.automation_enabled(NEW.user_id, 'proposal_create_deadline')
     AND COALESCE(NEW.timeline, '') <> '' THEN
    INSERT INTO public.deadlines (
      user_id, title, due_date, source, source_key,
      proposal_id, client_id, client_name
    ) VALUES (
      NEW.user_id,
      'Proposed deadline — ' || COALESCE(NEW.client_name, 'Client'),
      (now() + interval '14 days')::date,
      'proposal_timeline',
      'ptl-' || NEW.id::text,
      NEW.id, NEW.client_id, NEW.client_name
    ) ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposals_after_insert_automations ON public.proposals;
CREATE TRIGGER trg_proposals_after_insert_automations
  AFTER INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_proposals_after_insert_automations();

-- 7) Trigger: proposals AFTER UPDATE — proposal_notify_viewed
CREATE OR REPLACE FUNCTION public.tg_proposals_after_update_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.viewed_at IS NOT NULL AND OLD.viewed_at IS NULL
     AND public.automation_enabled(NEW.user_id, 'proposal_notify_viewed') THEN
    INSERT INTO public.user_notifications (
      user_id, category, key, title, body, metadata
    ) VALUES (
      NEW.user_id, 'proposal', 'proposal_viewed',
      'Proposal viewed',
      COALESCE(NEW.client_name, 'A client') || ' just opened your proposal.',
      jsonb_build_object('proposal_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposals_after_update_automations ON public.proposals;
CREATE TRIGGER trg_proposals_after_update_automations
  AFTER UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_proposals_after_update_automations();
