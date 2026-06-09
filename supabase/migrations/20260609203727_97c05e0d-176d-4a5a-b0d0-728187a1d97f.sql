
-- ============================================================
-- AUTOMATIONS WIRING — Tick (cron) + payment-event handler
-- ============================================================

-- A) Per-user scheduled tick. Idempotent via deadlines.source_key + notification key checks.
CREATE OR REPLACE FUNCTION public.automations_run_user_ticks(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count int;
  v_summary jsonb := '{}'::jsonb;
BEGIN
  -- 1) proposal_notify_expired: sent >14d ago, no response, no prior expired notification
  IF public.automation_enabled(_user_id, 'proposal_notify_expired') THEN
    v_count := 0;
    FOR r IN
      SELECT p.id, p.client_name
        FROM public.proposals p
       WHERE p.user_id = _user_id
         AND p.status IN ('sent','viewed')
         AND p.sent_at IS NOT NULL
         AND p.sent_at < now() - interval '14 days'
         AND NOT EXISTS (
           SELECT 1 FROM public.user_notifications n
            WHERE n.user_id = _user_id
              AND n.key = 'proposal_expired'
              AND (n.metadata ->> 'proposal_id')::uuid = p.id
         )
    LOOP
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'proposal', 'proposal_expired',
              'Proposal expired',
              'Your proposal to ' || COALESCE(r.client_name,'a client') || ' has been open over 14 days.',
              jsonb_build_object('proposal_id', r.id));
      v_count := v_count + 1;
    END LOOP;
    v_summary := v_summary || jsonb_build_object('proposal_notify_expired', v_count);
  END IF;

  -- 2) payment_follow_up_unpaid: retainer_invoices overdue, no follow-up deadline yet
  IF public.automation_enabled(_user_id, 'payment_follow_up_unpaid') THEN
    v_count := 0;
    FOR r IN
      SELECT ri.id, ri.retainer_id, ri.due_date,
             (SELECT client_name FROM public.retainers WHERE id = ri.retainer_id) AS client_name
        FROM public.retainer_invoices ri
       WHERE ri.user_id = _user_id
         AND ri.status IN ('scheduled','failed')
         AND ri.paid_at IS NULL
         AND ri.due_date < (now() - interval '3 days')::date
    LOOP
      INSERT INTO public.deadlines (user_id, title, due_date, source, source_key, priority, client_name)
      VALUES (_user_id,
              'Chase unpaid invoice — ' || COALESCE(r.client_name,'Client'),
              (now() + interval '1 day')::date,
              'invoice_followup',
              'invfu-' || r.id::text,
              'high', r.client_name)
      ON CONFLICT (user_id, source_key) DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
    v_summary := v_summary || jsonb_build_object('payment_follow_up_unpaid', v_count);
  END IF;

  -- 3) onboarding_remind_client: pending onboarding forms >3 days old, not reminded
  IF public.automation_enabled(_user_id, 'onboarding_remind_client') THEN
    v_count := 0;
    UPDATE public.onboarding_forms
       SET reminded_at = now()
     WHERE user_id = _user_id
       AND status IN ('pending','in_progress')
       AND (sent_at IS NOT NULL AND sent_at < now() - interval '3 days')
       AND (reminded_at IS NULL OR reminded_at < now() - interval '7 days');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_summary := v_summary || jsonb_build_object('onboarding_remind_client', v_count);
  END IF;

  -- 4) retainer_renewal_reminder: 14 days before next_billing_date
  IF public.automation_enabled(_user_id, 'retainer_renewal_reminder') THEN
    v_count := 0;
    FOR r IN
      SELECT id, client_name, next_billing_date
        FROM public.retainers
       WHERE user_id = _user_id
         AND status = 'active'
         AND next_billing_date IS NOT NULL
         AND next_billing_date BETWEEN (now())::date AND (now() + interval '14 days')::date
    LOOP
      INSERT INTO public.deadlines (user_id, title, due_date, source, source_key, retainer_id, client_name)
      VALUES (_user_id,
              'Retainer renewal — ' || COALESCE(r.client_name,'Client'),
              r.next_billing_date,
              'retainer_renewal',
              'rrw-' || r.id::text,
              r.id, r.client_name)
      ON CONFLICT (user_id, source_key) DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
    v_summary := v_summary || jsonb_build_object('retainer_renewal_reminder', v_count);
  END IF;

  -- 5) retainer_notify_before_renewal: 3 days before
  IF public.automation_enabled(_user_id, 'retainer_notify_before_renewal') THEN
    v_count := 0;
    FOR r IN
      SELECT id, client_name, next_billing_date
        FROM public.retainers
       WHERE user_id = _user_id
         AND status = 'active'
         AND next_billing_date IS NOT NULL
         AND next_billing_date BETWEEN (now())::date AND (now() + interval '3 days')::date
         AND NOT EXISTS (
           SELECT 1 FROM public.user_notifications n
            WHERE n.user_id = _user_id
              AND n.key = 'retainer_renewing'
              AND (n.metadata ->> 'retainer_id')::uuid = retainers.id
              AND n.created_at > now() - interval '4 days'
         )
    LOOP
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'retainer', 'retainer_renewing',
              'Retainer renewing soon',
              COALESCE(r.client_name,'A client') || ' renews on ' || r.next_billing_date::text,
              jsonb_build_object('retainer_id', r.id));
      v_count := v_count + 1;
    END LOOP;
    v_summary := v_summary || jsonb_build_object('retainer_notify_before_renewal', v_count);
  END IF;

  -- 6) retainer_generate_proposal_draft: draft a renewal proposal once per cycle
  IF public.automation_enabled(_user_id, 'retainer_generate_proposal_draft') THEN
    v_count := 0;
    FOR r IN
      SELECT id, client_id, client_name, company_name, service_type, amount_cents, currency, next_billing_date
        FROM public.retainers
       WHERE user_id = _user_id
         AND status = 'active'
         AND next_billing_date IS NOT NULL
         AND next_billing_date BETWEEN (now())::date AND (now() + interval '21 days')::date
         AND NOT EXISTS (
           SELECT 1 FROM public.proposals p
            WHERE p.user_id = _user_id
              AND p.status = 'draft'
              AND p.client_id = retainers.client_id
              AND p.created_at > now() - interval '21 days'
              AND p.notes LIKE '%retainer-renewal-draft%'
         )
    LOOP
      INSERT INTO public.proposals (
        user_id, client_id, client_name, company_name, service_type,
        project_scope, budget, timeline, notes, status, amount_cents, currency
      ) VALUES (
        _user_id, r.client_id, r.client_name, COALESCE(r.company_name,''),
        COALESCE(r.service_type,'Retainer renewal'),
        'Renewal of existing retainer engagement.', '', '',
        'retainer-renewal-draft', 'draft', r.amount_cents, COALESCE(r.currency,'USD')
      );
      v_count := v_count + 1;
    END LOOP;
    v_summary := v_summary || jsonb_build_object('retainer_generate_proposal_draft', v_count);
  END IF;

  -- 7) deadlines_notify_before: due within 7d/3d/1d
  IF public.automation_enabled(_user_id, 'deadlines_notify_before') THEN
    v_count := 0;
    FOR r IN
      SELECT id, title, due_date
        FROM public.deadlines
       WHERE user_id = _user_id
         AND status NOT IN ('done','cancelled')
         AND due_date BETWEEN (now())::date AND (now() + interval '7 days')::date
         AND NOT EXISTS (
           SELECT 1 FROM public.user_notifications n
            WHERE n.user_id = _user_id
              AND n.key = 'deadline_upcoming'
              AND (n.metadata ->> 'deadline_id')::uuid = deadlines.id
              AND n.created_at > now() - interval '24 hours'
         )
    LOOP
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'deadline', 'deadline_upcoming',
              'Deadline coming up',
              r.title || ' is due ' || r.due_date::text,
              jsonb_build_object('deadline_id', r.id));
      v_count := v_count + 1;
    END LOOP;
    v_summary := v_summary || jsonb_build_object('deadlines_notify_before', v_count);
  END IF;

  -- 8) deadlines_notify_overdue
  IF public.automation_enabled(_user_id, 'deadlines_notify_overdue') THEN
    v_count := 0;
    FOR r IN
      SELECT id, title, due_date
        FROM public.deadlines
       WHERE user_id = _user_id
         AND status NOT IN ('done','cancelled')
         AND due_date < (now())::date
         AND NOT EXISTS (
           SELECT 1 FROM public.user_notifications n
            WHERE n.user_id = _user_id
              AND n.key = 'deadline_overdue'
              AND (n.metadata ->> 'deadline_id')::uuid = deadlines.id
              AND n.created_at > now() - interval '24 hours'
         )
    LOOP
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'deadline', 'deadline_overdue',
              'Deadline overdue',
              r.title || ' was due ' || r.due_date::text,
              jsonb_build_object('deadline_id', r.id));
      v_count := v_count + 1;
    END LOOP;
    v_summary := v_summary || jsonb_build_object('deadlines_notify_overdue', v_count);
  END IF;

  RETURN v_summary;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.automations_run_user_ticks(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automations_run_user_ticks(uuid) TO service_role;

-- B) Payment-event handler used by webhook + tests.
-- _kind in: 'proposal_paid','retainer_paid','proposal_failed','retainer_failed'
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
  v_client_email text;
  v_form_exists boolean;
  v_did jsonb := '{}'::jsonb;
BEGIN
  IF _kind = 'proposal_paid' AND _proposal_id IS NOT NULL THEN
    SELECT p.client_name,
           (SELECT email FROM public.clients WHERE id = p.client_id)
      INTO v_client_name, v_client_email
      FROM public.proposals p WHERE p.id = _proposal_id;

    -- payment_notify_received
    IF public.automation_enabled(_user_id, 'payment_notify_received') THEN
      INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
      VALUES (_user_id, 'payment', 'payment_received',
              'Payment received',
              'Received ' || (_amount_cents::numeric / 100)::text || ' ' || _currency || ' from ' || COALESCE(v_client_name,'a client'),
              jsonb_build_object('proposal_id', _proposal_id, 'amount_cents', _amount_cents, 'currency', _currency));
      v_did := v_did || jsonb_build_object('payment_notify_received', true);
    END IF;

    -- payment_auto_confirmation (record intent; actual email sent by edge fn)
    IF public.automation_enabled(_user_id, 'payment_auto_confirmation') THEN
      v_did := v_did || jsonb_build_object('payment_auto_confirmation', true);
    END IF;

    -- onboarding_auto_send: create pending onboarding form if not already present
    IF public.automation_enabled(_user_id, 'onboarding_auto_send') THEN
      SELECT EXISTS (
        SELECT 1 FROM public.onboarding_forms WHERE proposal_id = _proposal_id
      ) INTO v_form_exists;
      IF NOT v_form_exists THEN
        INSERT INTO public.onboarding_forms (
          user_id, proposal_id,
          client_id, client_name, client_email,
          status, sent_at
        )
        SELECT p.user_id, p.id, p.client_id, p.client_name, v_client_email, 'pending', now()
          FROM public.proposals p WHERE p.id = _proposal_id;
        v_did := v_did || jsonb_build_object('onboarding_auto_send', true);
      END IF;
    END IF;

    -- onboarding_auto_task
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
