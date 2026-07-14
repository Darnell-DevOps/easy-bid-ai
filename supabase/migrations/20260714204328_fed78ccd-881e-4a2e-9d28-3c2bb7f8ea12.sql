CREATE OR REPLACE FUNCTION public.public_get_testimonials_for_user(_user_id uuid)
RETURNS TABLE (
  client_name text,
  company text,
  role_title text,
  rating integer,
  content text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.client_name,
    t.company,
    t.role_title,
    t.rating,
    t.content,
    t.avatar_url
  FROM public.testimonials t
  WHERE t.user_id = _user_id
    AND t.is_published = true
    AND t.allow_public = true
  ORDER BY t.is_featured DESC, t.created_at DESC
  LIMIT 6;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_testimonials_for_user(uuid) TO anon, authenticated;