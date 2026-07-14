CREATE OR REPLACE FUNCTION public.contract_countersign(_contract_id uuid, _signer_name text, _signer_email text, _method text, _signature_data text, _ua text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_sig_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_contract FROM public.contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF v_contract.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to countersign this contract';
  END IF;
  IF v_contract.status <> 'signed' THEN
    RAISE EXCEPTION 'Client must sign before you can countersign';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contract_signatures
              WHERE contract_id = _contract_id AND signer_role = 'provider') THEN
    RAISE EXCEPTION 'Contract already countersigned';
  END IF;
  IF _method NOT IN ('typed','drawn') THEN RAISE EXCEPTION 'Invalid signature method'; END IF;
  IF length(coalesce(_signer_name,'')) < 2 THEN RAISE EXCEPTION 'Signer name required'; END IF;

  INSERT INTO public.contract_signatures (
    contract_id, user_id, signer_name, signer_email, method, signature_data, user_agent, signer_role
  ) VALUES (
    _contract_id, v_contract.user_id, _signer_name, _signer_email, _method, _signature_data, _ua, 'provider'
  ) RETURNING id INTO v_sig_id;

  UPDATE public.contracts
     SET status = 'executed',
         countersigned_at = now(),
         countersigner_name = _signer_name
   WHERE id = _contract_id;

  UPDATE public.deadlines
     SET status = 'done', completed_at = now()
   WHERE user_id = v_contract.user_id
     AND contract_id = _contract_id
     AND source = 'contract_countersign'
     AND status <> 'done';

  -- Defensive: also complete any lingering contract_follow_up deadline.
  -- contract_sign already does this at client-signing time, but this guards
  -- against a follow-up being re-created/re-opened between signing and countersign.
  IF public.automation_enabled(v_contract.user_id, 'contract_follow_up') THEN
    UPDATE public.deadlines
       SET status = 'done', completed_at = now()
     WHERE user_id = v_contract.user_id
       AND contract_id = _contract_id
       AND source = 'contract_follow_up'
       AND status <> 'done';
  END IF;

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

  INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
  VALUES (
    v_contract.user_id, 'contract', 'contract_executed',
    'Contract executed',
    'You countersigned ' || v_contract.title || '. A copy has been sent to ' || COALESCE(v_contract.client_name,'the client') || '.',
    jsonb_build_object('contract_id', v_contract.id)
  );

  RETURN v_sig_id;
END;
$function$;