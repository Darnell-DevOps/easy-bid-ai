
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS sent_source text,
  ADD COLUMN IF NOT EXISTS viewed_source text,
  ADD COLUMN IF NOT EXISTS accepted_source text,
  ADD COLUMN IF NOT EXISTS rejected_source text;

CREATE OR REPLACE FUNCTION public.client_portal_respond(_proposal_id uuid, _action text, _message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prop public.proposals%ROWTYPE;
  v_contract_id uuid;
  v_is_new boolean := false;
BEGIN
  IF _action NOT IN ('view','accept','reject') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT * INTO v_prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;

  IF _action = 'view' THEN
    UPDATE public.proposals
       SET viewed_at = COALESCE(viewed_at, now()),
           viewed_source = COALESCE(viewed_source, 'client'),
           status = CASE WHEN status IN ('draft','sent') THEN 'viewed' ELSE status END
     WHERE id = _proposal_id;
    RETURN jsonb_build_object('contract_id', NULL, 'contract_is_new', false);

  ELSIF _action = 'accept' THEN
    UPDATE public.proposals
       SET status = 'accepted',
           accepted_at = COALESCE(accepted_at, now()),
           accepted_source = COALESCE(accepted_source, 'client'),
           rejected_at = NULL,
           rejected_source = NULL,
           client_response_message = COALESCE(_message, client_response_message)
     WHERE id = _proposal_id;

    IF public.automation_enabled(v_prop.user_id, 'contract_auto_generate') THEN
      INSERT INTO public.contracts (
        user_id, proposal_id, client_id, contract_type, title,
        client_name, company_name, body, currency, amount_cents, status, source
      ) VALUES (
        v_prop.user_id, v_prop.id, v_prop.client_id,
        CASE WHEN v_prop.service_type ~* 'retainer' THEN 'retainer_agreement' ELSE 'service_agreement' END,
        (CASE WHEN v_prop.service_type ~* 'retainer' THEN 'Retainer Agreement' ELSE 'Service Agreement' END) || ' — ' || COALESCE(v_prop.client_name, 'Client'),
        v_prop.client_name, v_prop.company_name, '', COALESCE(v_prop.currency, 'USD'), NULL, 'draft', 'acceptance_auto'
      )
      ON CONFLICT (proposal_id) WHERE source = 'acceptance_auto' AND deleted_at IS NULL DO NOTHING
      RETURNING id INTO v_contract_id;

      IF v_contract_id IS NOT NULL THEN
        v_is_new := true;
      ELSE
        SELECT id INTO v_contract_id FROM public.contracts
          WHERE proposal_id = v_prop.id AND source = 'acceptance_auto' AND deleted_at IS NULL
          LIMIT 1;
      END IF;
    END IF;

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

    RETURN jsonb_build_object('contract_id', v_contract_id, 'contract_is_new', v_is_new);

  ELSIF _action = 'reject' THEN
    UPDATE public.proposals
       SET status = 'rejected',
           rejected_at = COALESCE(rejected_at, now()),
           rejected_source = COALESCE(rejected_source, 'client'),
           accepted_at = NULL,
           accepted_source = NULL,
           client_response_message = COALESCE(_message, client_response_message)
     WHERE id = _proposal_id;
    RETURN jsonb_build_object('contract_id', NULL, 'contract_is_new', false);
  END IF;

  RETURN jsonb_build_object('contract_id', NULL, 'contract_is_new', false);
END;
$function$;
