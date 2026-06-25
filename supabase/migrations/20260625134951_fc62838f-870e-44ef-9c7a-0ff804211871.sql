CREATE OR REPLACE FUNCTION public.get_public_branding(p_user_id uuid)
RETURNS TABLE (favicon_url text, business_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT favicon_url, business_name
  FROM public.business_branding
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding(uuid) TO anon, authenticated;