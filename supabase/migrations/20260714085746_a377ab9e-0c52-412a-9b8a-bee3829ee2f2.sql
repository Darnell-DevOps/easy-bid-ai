CREATE OR REPLACE FUNCTION public.public_get_proposal_branding_for_user(_user_id uuid)
RETURNS TABLE (
  business_name text,
  tagline text,
  logo_url text,
  brand_color text,
  brand_secondary_color text,
  show_logo_on_proposals boolean,
  show_logo_on_contracts boolean,
  show_logo_on_portal boolean,
  proposal_cover_show_name boolean,
  proposal_cover_show_tagline boolean,
  proposal_cover_show_date boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    business_name,
    tagline,
    logo_url,
    brand_color,
    brand_secondary_color,
    show_logo_on_proposals,
    show_logo_on_contracts,
    show_logo_on_portal,
    proposal_cover_show_name,
    proposal_cover_show_tagline,
    proposal_cover_show_date
  FROM public.business_branding
  WHERE user_id = _user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_proposal_branding_for_user(uuid) TO anon, authenticated;