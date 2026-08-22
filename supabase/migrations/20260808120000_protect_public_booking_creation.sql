-- Public bookings must pass through the rate-limited create-public-booking
-- Edge Function. Authenticated hosts retain their existing owner-scoped INSERT
-- policy for bookings they create from the calendar.
DROP POLICY IF EXISTS "Public create bookings via link" ON public.bookings;
REVOKE INSERT ON public.bookings FROM anon;

-- The protected Edge Function returns the newly-created booking's token to the
-- caller, so a public UUID-to-token lookup is no longer required.
REVOKE EXECUTE ON FUNCTION public.public_get_booking_reschedule_token(uuid)
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'bookings'
       AND cmd = 'INSERT'
       AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION 'Anonymous booking INSERT policy still exists';
  END IF;
END;
$$;
