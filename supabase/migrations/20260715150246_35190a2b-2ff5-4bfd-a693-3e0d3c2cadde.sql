CREATE OR REPLACE FUNCTION public.public_get_proposal_by_id(_id uuid)
RETURNS SETOF proposals
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (jsonb_populate_record(NULL::public.proposals, to_jsonb(p) - 'acceptance_evidence' - 'paddle_transaction_id')).*
  FROM public.proposals p
  WHERE p.id = _id
  LIMIT 1;
$function$;