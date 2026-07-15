
REVOKE EXECUTE ON FUNCTION public.onboarding_mark_reviewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboarding_mark_reviewed(uuid) TO authenticated;
