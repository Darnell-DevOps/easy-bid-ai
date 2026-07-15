
REVOKE EXECUTE ON FUNCTION public.onboarding_mark_reviewed(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboarding_mark_reviewed(uuid) TO authenticated, service_role;
