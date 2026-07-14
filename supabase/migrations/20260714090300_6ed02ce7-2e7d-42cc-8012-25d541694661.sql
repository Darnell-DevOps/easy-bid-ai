CREATE OR REPLACE FUNCTION public.public_get_policies_for_user(_user_id uuid)
RETURNS TABLE (policy_type text, content text, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT policy_type, content, updated_at
  FROM public.policies
  WHERE user_id = _user_id
    AND content IS NOT NULL
    AND length(btrim(content)) > 0
  ORDER BY policy_type;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_policies_for_user(uuid) TO anon, authenticated;