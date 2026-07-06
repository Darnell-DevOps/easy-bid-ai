CREATE OR REPLACE FUNCTION public.public_get_booking_reschedule_token(_booking_id uuid)
RETURNS TABLE(reschedule_token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT reschedule_token FROM public.bookings WHERE id = _booking_id LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_booking_reschedule_token(uuid) TO anon, authenticated;