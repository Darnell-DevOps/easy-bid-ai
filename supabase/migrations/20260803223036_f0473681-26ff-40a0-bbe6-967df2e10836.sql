-- Internal helper: only ever called from inside other SECURITY DEFINER functions
-- and from server-side (service_role) code. Not referenced by any RLS policy or client.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Automation toggle lookup: invoked only by edge functions using the service role.
REVOKE EXECUTE ON FUNCTION public.automation_enabled(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_enabled(uuid, text) TO service_role;

-- Verified custom-domain resolver: server-side only (custom domain routing).
REVOKE EXECUTE ON FUNCTION public.public_get_verified_domain(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_verified_domain(text) TO service_role;

-- Owner-scoped custom domain lookup must never be anonymous.
REVOKE EXECUTE ON FUNCTION public.get_primary_custom_domain(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_primary_custom_domain(uuid) TO authenticated, service_role;