CREATE OR REPLACE FUNCTION public.public_get_onboarding_by_proposal(_proposal_id uuid)
RETURNS SETOF public.onboarding_forms
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.onboarding_forms
   WHERE proposal_id = _proposal_id
   ORDER BY created_at DESC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_onboarding_by_proposal(uuid) TO anon, authenticated;