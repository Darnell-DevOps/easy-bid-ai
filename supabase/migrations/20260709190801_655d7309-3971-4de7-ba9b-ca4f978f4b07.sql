
ALTER TABLE public.booking_links ADD COLUMN IF NOT EXISTS is_kickoff_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS booking_links_one_kickoff_default_per_user
  ON public.booking_links (user_id) WHERE is_kickoff_default = true;

CREATE OR REPLACE FUNCTION public.public_get_kickoff_booking_link_for_user(_user_id uuid)
RETURNS TABLE (slug text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug, name
  FROM public.booking_links
  WHERE user_id = _user_id
    AND is_kickoff_default = true
    AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_kickoff_booking_link_for_user(uuid) TO anon, authenticated;
