
ALTER TABLE public.onboarding_forms
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS project_stage_proposal_id uuid;

CREATE OR REPLACE FUNCTION public.recompute_kickoff_readiness(_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_stage text;
  v_qualifying_proposal_id uuid;
BEGIN
  IF _client_id IS NULL THEN RETURN; END IF;
  SELECT project_stage INTO current_stage FROM public.clients WHERE id = _client_id;
  IF current_stage IS NOT NULL THEN RETURN; END IF;

  SELECT p.id INTO v_qualifying_proposal_id
  FROM public.proposals p
  WHERE p.client_id = _client_id
    AND (
      COALESCE(p.amount_cents, 0) = 0 OR p.client_paid = true
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.proposal_id = p.id AND c.status = 'executed' AND c.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.onboarding_forms o
      WHERE o.proposal_id = p.id AND o.status = 'completed'
        AND o.reviewed_at IS NOT NULL AND o.deleted_at IS NULL
    )
  ORDER BY p.accepted_at DESC NULLS LAST
  LIMIT 1;

  IF v_qualifying_proposal_id IS NOT NULL THEN
    UPDATE public.clients
       SET project_stage = 'ready_for_kickoff',
           project_stage_proposal_id = v_qualifying_proposal_id
     WHERE id = _client_id AND project_stage IS NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.onboarding_mark_reviewed(_form_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_status text;
  v_client_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _form_id IS NULL THEN
    RAISE EXCEPTION 'form id required';
  END IF;

  SELECT user_id, status, client_id
    INTO v_owner, v_status, v_client_id
  FROM public.onboarding_forms
  WHERE id = _form_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'onboarding form not found';
  END IF;
  IF v_owner <> v_caller THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_status <> 'completed' THEN
    RAISE EXCEPTION 'onboarding form is not completed';
  END IF;

  UPDATE public.onboarding_forms
     SET reviewed_at = COALESCE(reviewed_at, now()),
         reviewed_by = COALESCE(reviewed_by, v_caller)
   WHERE id = _form_id;

  IF v_client_id IS NOT NULL THEN
    PERFORM public.recompute_kickoff_readiness(v_client_id);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.onboarding_mark_reviewed(uuid) TO authenticated;
