CREATE OR REPLACE FUNCTION public.public_get_project_stage_for_proposal(_proposal_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.project_stage
  FROM public.proposals p
  JOIN public.clients c ON c.id = p.client_id
  WHERE p.id = _proposal_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_project_stage_for_proposal(uuid) TO anon, authenticated;