REVOKE EXECUTE ON FUNCTION public.mark_proposal_paid(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_proposal_paid(uuid, text) TO service_role;