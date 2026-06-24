
ALTER TABLE public.contract_signatures
  ADD COLUMN IF NOT EXISTS signer_role text NOT NULL DEFAULT 'client'
    CHECK (signer_role IN ('client','provider'));

UPDATE public.contract_signatures SET signer_role = 'client' WHERE signer_role IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contract_signatures_contract_role_uniq
  ON public.contract_signatures (contract_id, signer_role);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS countersigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS countersigner_name text;

CREATE OR REPLACE FUNCTION public.contract_countersign(
  _contract_id uuid,
  _signer_name text,
  _signer_email text,
  _method text,
  _signature_data text,
  _ua text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
  VALUES (
    v_contract.user_id, 'contract', 'contract_executed',
    'Contract executed',
    'You countersigned ' || v_contract.title || '. A copy has been sent to ' || COALESCE(v_contract.client_name,'the client') || '.',
    jsonb_build_object('contract_id', v_contract.id)
  );

  RETURN v_sig_id;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_countersign(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_countersign(uuid,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_sign(_token text, _signer_name text, _signer_email text, _method text, _signature_data text, _ip text, _ua text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_sig_id uuid;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE signing_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid signing token'; END IF;
  IF v_contract.status IN ('signed','executed') THEN RAISE EXCEPTION 'Contract already signed'; END IF;
  IF _method NOT IN ('typed','drawn') THEN RAISE EXCEPTION 'Invalid signature method'; END IF;
  IF length(coalesce(_signer_name,'')) < 2 THEN RAISE EXCEPTION 'Signer name required'; END IF;

  INSERT INTO public.contract_signatures (
    contract_id, user_id, signer_name, signer_email, method, signature_data, ip_address, user_agent, signer_role
  ) VALUES (
    v_contract.id, v_contract.user_id, _signer_name, _signer_email, _method, _signature_data, _ip, _ua, 'client'
  ) RETURNING id INTO v_sig_id;

  UPDATE public.contracts
     SET status = 'signed', signed_at = now(), viewed_at = COALESCE(viewed_at, now())
   WHERE id = v_contract.id;

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

  IF public.automation_enabled(v_contract.user_id, 'contract_follow_up') THEN
    UPDATE public.deadlines
       SET status = 'done', completed_at = now()
     WHERE user_id = v_contract.user_id
       AND contract_id = v_contract.id
       AND source = 'contract_follow_up'
       AND status <> 'done';
  END IF;

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

  INSERT INTO public.deadlines (
    user_id, title, due_date, source, source_key,
    contract_id, client_id, client_name, priority
  ) VALUES (
    v_contract.user_id,
    'Countersign contract — ' || COALESCE(v_contract.client_name, 'Client'),
    (now() + interval '1 day')::date,
    'contract_countersign',
    'cntsgn-' || v_contract.id::text,
    v_contract.id, v_contract.client_id, v_contract.client_name, 'high'
  ) ON CONFLICT (user_id, source_key) DO NOTHING;

  INSERT INTO public.user_notifications (
    user_id, category, key, title, body, metadata
  ) VALUES (
    v_contract.user_id, 'contract', 'contract_awaiting_countersign',
    'Contract awaiting your countersignature',
    COALESCE(v_contract.client_name, 'A client') || ' signed ' || v_contract.title || '. Countersign to make it executed.',
    jsonb_build_object('contract_id', v_contract.id, 'signer_name', _signer_name)
  );

  RETURN v_sig_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_contract_owner_email(_token text)
RETURNS TABLE(user_id uuid, owner_email text, owner_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.user_id,
         u.email::text AS owner_email,
         COALESCE(NULLIF(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
                  p.business_name,
                  u.email::text) AS owner_name
    FROM public.contracts c
    JOIN auth.users u ON u.id = c.user_id
    LEFT JOIN public.user_profiles p ON p.user_id = c.user_id
   WHERE c.signing_token = _token
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_contract_owner_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_owner_email(text) TO anon, authenticated;
