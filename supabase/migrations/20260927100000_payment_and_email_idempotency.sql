-- Durable payment inbox. Only verified webhooks and service workers may access it.
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  event_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  claim_token uuid,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment, event_id)
);
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_events FROM anon, authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
CREATE INDEX IF NOT EXISTS payment_webhook_pending ON public.payment_webhook_events(available_at, occurred_at) WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.claim_payment_webhook_event()
RETURNS SETOF public.payment_webhook_events LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- A single consumer keeps subscription transitions and related transactions serial.
  PERFORM pg_advisory_xact_lock(27100001);
  IF EXISTS (SELECT 1 FROM payment_webhook_events WHERE status = 'processing' AND lease_until > now()) THEN RETURN; END IF;
  RETURN QUERY
  UPDATE payment_webhook_events e SET status = 'processing', attempts = attempts + 1,
    claim_token = gen_random_uuid(), lease_until = now() + interval '10 minutes'
  WHERE (e.environment, e.event_id) = (
    SELECT q.environment, q.event_id FROM payment_webhook_events q
    WHERE (q.status = 'pending' AND q.available_at <= now())
       OR (q.status = 'processing' AND q.lease_until <= now())
    ORDER BY q.occurred_at, q.created_at LIMIT 1 FOR UPDATE SKIP LOCKED
  ) RETURNING e.*;
END;
$$;
CREATE OR REPLACE FUNCTION public.finish_payment_webhook_event(_environment text, _event_id text, _claim_token uuid, _error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE payment_webhook_events SET
    status = CASE WHEN _error IS NULL THEN 'processed' WHEN attempts >= 15 THEN 'failed' ELSE 'pending' END,
    available_at = now() + make_interval(secs => LEAST(600, 10 * attempts)),
    processed_at = CASE WHEN _error IS NULL THEN now() ELSE NULL END,
    last_error = left(_error, 1000), lease_until = NULL, claim_token = NULL
  WHERE environment = _environment AND event_id = _event_id AND claim_token = _claim_token AND status = 'processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment event lease lost'; END IF;
END;
$$;

-- Atomic financial effects survive both duplicate events and worker crashes.
CREATE TABLE IF NOT EXISTS public.retainer_payment_effects (
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  effect_key text NOT NULL,
  retainer_id uuid NOT NULL,
  transaction_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('paid', 'failed')),
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment, effect_key)
);
ALTER TABLE public.retainer_payment_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retainer_payment_effects FROM anon, authenticated;
GRANT ALL ON public.retainer_payment_effects TO service_role;
-- Abort deployment if historical duplicates exist; never delete financial history.
CREATE UNIQUE INDEX IF NOT EXISTS retainer_invoice_paddle_transaction ON public.retainer_invoices(paddle_transaction_id) WHERE paddle_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_retainer_payment(_environment text, _event_id text, _retainer_id uuid, _transaction_id text, _kind text, _amount_cents integer, _currency text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.retainers; previous public.retainer_payment_effects; v_key text; v_retry integer;
BEGIN
  IF _environment NOT IN ('sandbox', 'live') OR _kind NOT IN ('paid', 'failed') OR _amount_cents < 0 OR _transaction_id IS NULL THEN
    RAISE EXCEPTION 'Invalid payment values';
  END IF;
  SELECT * INTO STRICT r FROM retainers WHERE id = _retainer_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM retainer_invoices WHERE paddle_transaction_id = _transaction_id AND retainer_id <> r.id) THEN RAISE EXCEPTION 'Payment transaction belongs to another retainer'; END IF;
  IF r.environment IS NOT NULL AND r.environment <> _environment THEN RAISE EXCEPTION 'Retainer environment mismatch'; END IF;
  IF upper(r.currency) <> upper(_currency) THEN RAISE EXCEPTION 'Retainer currency mismatch'; END IF;
  v_key := CASE WHEN _kind = 'paid' THEN 'paid:' || _transaction_id ELSE 'failed:' || _event_id END;
  SELECT * INTO previous FROM retainer_payment_effects WHERE environment = _environment AND effect_key = v_key;
  IF FOUND THEN RETURN jsonb_build_object('duplicate', true, 'retry_count', previous.retry_count); END IF;
  -- Late failure notifications cannot undo a confirmed payment.
  IF _kind = 'failed' AND EXISTS (SELECT 1 FROM retainer_invoices WHERE paddle_transaction_id = _transaction_id AND status = 'paid') THEN
    RETURN jsonb_build_object('ignored', true);
  END IF;
  -- Recognise pre-migration paid invoices without adding revenue again.
  IF _kind = 'paid' AND EXISTS (SELECT 1 FROM retainer_invoices WHERE paddle_transaction_id = _transaction_id AND status = 'paid') THEN
    INSERT INTO retainer_payment_effects(environment,effect_key,retainer_id,transaction_id,kind) VALUES (_environment,v_key,r.id,_transaction_id,_kind);
    RETURN jsonb_build_object('duplicate', true, 'retry_count', 0);
  END IF;
  v_retry := CASE WHEN _kind = 'failed' THEN r.payment_retry_count + 1 ELSE 0 END;
  INSERT INTO retainer_payment_effects(environment,effect_key,retainer_id,transaction_id,kind,retry_count)
    VALUES (_environment,v_key,r.id,_transaction_id,_kind,v_retry);
  INSERT INTO retainer_invoices(user_id,retainer_id,amount_cents,currency,due_date,paid_at,failed_at,failure_reason,paddle_transaction_id,status)
  VALUES (r.user_id,r.id,_amount_cents,upper(_currency),current_date,
    CASE WHEN _kind = 'paid' THEN now() END, CASE WHEN _kind = 'failed' THEN now() END,_reason,_transaction_id,_kind)
  ON CONFLICT (paddle_transaction_id) WHERE paddle_transaction_id IS NOT NULL DO UPDATE
  SET status = EXCLUDED.status, amount_cents = EXCLUDED.amount_cents, paid_at = EXCLUDED.paid_at,
    failed_at = EXCLUDED.failed_at, failure_reason = EXCLUDED.failure_reason,
    recovered_at = CASE WHEN EXCLUDED.status = 'paid' AND retainer_invoices.status = 'failed' THEN now() ELSE retainer_invoices.recovered_at END;
  UPDATE retainers SET
    total_billed_cents = total_billed_cents + CASE WHEN _kind = 'paid' THEN _amount_cents ELSE 0 END,
    total_payments_count = total_payments_count + CASE WHEN _kind = 'paid' THEN 1 ELSE 0 END,
    last_billed_date = CASE WHEN _kind = 'paid' THEN current_date ELSE last_billed_date END,
    has_failed_payment = (_kind = 'failed'), failed_payment_reason = CASE WHEN _kind = 'failed' THEN _reason END,
    failed_payment_at = CASE WHEN _kind = 'failed' THEN now() END, payment_retry_count = v_retry,
    payment_recovered_at = CASE WHEN _kind = 'paid' THEN now() ELSE payment_recovered_at END,
    status = CASE WHEN _kind = 'failed' THEN 'past_due' WHEN status = 'past_due' THEN 'active' ELSE status END
  WHERE id = r.id;
  IF _kind = 'paid' THEN
    UPDATE retainer_reminders SET status = 'resolved', sent_at = now()
      WHERE retainer_id = r.id AND kind IN ('payment_failed','payment_final') AND status = 'pending';
  ELSE
    INSERT INTO retainer_reminders(user_id,retainer_id,kind,scheduled_for,status,channel)
      VALUES (r.user_id,r.id,CASE WHEN v_retry >= 3 THEN 'payment_final' ELSE 'payment_failed' END,now(),'pending','in_app')
      ON CONFLICT (retainer_id,kind) DO UPDATE SET scheduled_for = now(),status = 'pending';
  END IF;
  RETURN jsonb_build_object('duplicate',false,'retry_count',v_retry);
END;
$$;

-- Provider timestamps protect entitlements against out-of-order delivery.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS paddle_updated_at timestamptz;
CREATE OR REPLACE FUNCTION public.apply_paddle_plan_state(_user_id uuid, _subscription_id text, _customer_id text, _price_id text, _environment text, _plan text, _period_end timestamptz, _cancel_at_period_end boolean, _updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _plan NOT IN ('free','starter','pro') OR _environment NOT IN ('sandbox','live') OR _updated_at IS NULL THEN RAISE EXCEPTION 'Invalid plan state'; END IF;
  INSERT INTO subscriptions(user_id,plan,paddle_subscription_id,paddle_customer_id,paddle_price_id,environment,current_period_end,cancel_at_period_end,paddle_updated_at)
  VALUES (_user_id,_plan,CASE WHEN _plan <> 'free' THEN _subscription_id END,_customer_id,_price_id,_environment,_period_end,_cancel_at_period_end,_updated_at)
  ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan,paddle_subscription_id = EXCLUDED.paddle_subscription_id,
    paddle_customer_id = EXCLUDED.paddle_customer_id,paddle_price_id = EXCLUDED.paddle_price_id,environment = EXCLUDED.environment,
    current_period_end = EXCLUDED.current_period_end,cancel_at_period_end = EXCLUDED.cancel_at_period_end,paddle_updated_at = EXCLUDED.paddle_updated_at
  WHERE (subscriptions.paddle_updated_at IS NULL OR subscriptions.paddle_updated_at <= EXCLUDED.paddle_updated_at)
    AND (_plan <> 'free' OR subscriptions.paddle_subscription_id IS NULL OR subscriptions.paddle_subscription_id = _subscription_id);
END;
$$;

-- An atomic email reservation precedes network delivery. Ambiguous delivery is
-- held for reconciliation, never silently retried after a worker crash.
ALTER TABLE public.email_send_log ADD COLUMN IF NOT EXISTS request_hash text, ADD COLUMN IF NOT EXISTS claim_token uuid;
CREATE OR REPLACE FUNCTION public.claim_email_send(_key text, _legacy_key text, _user_id uuid, _template text, _recipient text, _subject text, _request_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.email_send_log; v_token uuid := gen_random_uuid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_key,0));
  SELECT * INTO r FROM email_send_log WHERE idempotency_key = _legacy_key AND user_id IS NOT DISTINCT FROM _user_id AND status = 'sent';
  IF FOUND AND r.recipient = _recipient AND r.template = _template THEN RETURN jsonb_build_object('status','sent','id',r.id); END IF;
  INSERT INTO email_send_log(user_id,template,recipient,subject,status,idempotency_key,request_hash,claim_token)
    VALUES (_user_id,_template,_recipient,_subject,'sending',_key,_request_hash,v_token) ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT * INTO STRICT r FROM email_send_log WHERE idempotency_key = _key FOR UPDATE;
  IF r.user_id IS DISTINCT FROM _user_id OR r.request_hash IS DISTINCT FROM _request_hash THEN
    RETURN jsonb_build_object('status','conflict');
  END IF;
  IF r.claim_token = v_token THEN RETURN jsonb_build_object('status','claimed','id',r.id,'token',v_token); END IF;
  IF r.status = 'failed' THEN
    UPDATE email_send_log SET status = 'sending',claim_token = v_token,error = NULL WHERE id = r.id;
    RETURN jsonb_build_object('status','claimed','id',r.id,'token',v_token);
  END IF;
  RETURN jsonb_build_object('status',r.status,'id',r.id,'provider_id',r.provider_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.finish_email_send(_id uuid, _token uuid, _status text, _provider_id text DEFAULT NULL, _error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('sent','failed','uncertain') THEN RAISE EXCEPTION 'Invalid send outcome'; END IF;
  UPDATE email_send_log SET status = _status,provider_id = _provider_id,error = left(_error,1000),claim_token = NULL
    WHERE id = _id AND claim_token = _token AND status = 'sending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Email claim lost'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_webhook_event(), public.finish_payment_webhook_event(text,text,uuid,text), public.record_retainer_payment(text,text,uuid,text,text,integer,text,text), public.apply_paddle_plan_state(uuid,text,text,text,text,text,timestamptz,boolean,timestamptz), public.claim_email_send(text,text,uuid,text,text,text,text), public.finish_email_send(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_webhook_event(), public.finish_payment_webhook_event(text,text,uuid,text), public.record_retainer_payment(text,text,uuid,text,text,integer,text,text), public.apply_paddle_plan_state(uuid,text,text,text,text,text,timestamptz,boolean,timestamptz), public.claim_email_send(text,text,uuid,text,text,text,text), public.finish_email_send(uuid,uuid,text,text,text) TO service_role;
INSERT INTO public.automation_job_registry(job_name,function_name,interval_minutes) VALUES ('payment-events','payment-event-worker',1) ON CONFLICT (job_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prepare_payment_onboarding(_proposal_id uuid, _fields jsonb, _responses jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed jsonb;
BEGIN
  claimed := public.claim_onboarding_form(_proposal_id);
  IF (claimed->>'is_new')::boolean THEN
    UPDATE onboarding_forms SET fields = _fields, responses = _responses WHERE id = (claimed->>'form_id')::uuid;
  END IF;
  -- Claim and initialization commit together; retries cannot leave an empty form.
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_payment_onboarding(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_payment_onboarding(uuid,jsonb,jsonb) TO service_role;
