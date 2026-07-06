-- Drop permissive anon SELECT policies on onboarding_forms, bookings, booking_links
DROP POLICY IF EXISTS "Public view onboarding by token" ON public.onboarding_forms;
DROP POLICY IF EXISTS "Public view bookings for proposal" ON public.bookings;
DROP POLICY IF EXISTS "Public view booking links by slug" ON public.booking_links;

-- Also revoke anon SELECT since access is now via SECURITY DEFINER RPCs
REVOKE SELECT ON public.onboarding_forms FROM anon;
REVOKE SELECT ON public.bookings FROM anon;
REVOKE SELECT ON public.booking_links FROM anon;

-- Token-scoped onboarding form fetch
CREATE OR REPLACE FUNCTION public.public_get_onboarding_by_token(_token text)
RETURNS SETOF public.onboarding_forms
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.onboarding_forms WHERE access_token = _token LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_onboarding_by_token(text) TO anon, authenticated;

-- Proposal-scoped bookings fetch (used by ClientPortal to show booked kickoff calls)
CREATE OR REPLACE FUNCTION public.public_get_bookings_for_proposal(_proposal_id uuid)
RETURNS SETOF public.bookings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.bookings
   WHERE proposal_id = _proposal_id
   ORDER BY scheduled_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_bookings_for_proposal(uuid) TO anon, authenticated;

-- Slug-scoped booking link fetch (public booking page)
CREATE OR REPLACE FUNCTION public.public_get_booking_link_by_slug(_slug text)
RETURNS SETOF public.booking_links
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.booking_links WHERE slug = _slug AND is_active = true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_booking_link_by_slug(text) TO anon, authenticated;

-- First active booking link (slug + name) for a given user — used by ClientPortal
-- and ContractSignPage kickoff CTAs. Returns only minimal display fields.
CREATE OR REPLACE FUNCTION public.public_get_first_booking_link_for_user(_user_id uuid)
RETURNS TABLE(slug text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug, name
    FROM public.booking_links
   WHERE user_id = _user_id AND is_active = true
   ORDER BY created_at ASC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_first_booking_link_for_user(uuid) TO anon, authenticated;

-- Busy slot lookup for a booking link (public availability calculation).
-- Only returns future scheduled_at + duration for that link's owner.
CREATE OR REPLACE FUNCTION public.public_get_booking_link_busy(_slug text)
RETURNS TABLE(scheduled_at timestamptz, duration_minutes int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.scheduled_at, b.duration_minutes
    FROM public.bookings b
    JOIN public.booking_links l ON l.user_id = b.user_id
   WHERE l.slug = _slug
     AND l.is_active = true
     AND b.scheduled_at >= now()
     AND b.status <> 'cancelled';
$$;
GRANT EXECUTE ON FUNCTION public.public_get_booking_link_busy(text) TO anon, authenticated;