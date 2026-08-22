-- Public bookings must pass through the rate-limited create-public-booking
-- Edge Function. Authenticated hosts retain their existing owner-scoped INSERT
-- policy for bookings they create from the calendar.
DROP POLICY IF EXISTS "Public create bookings via link" ON public.bookings;

-- The original owner policy did not name a role, so PostgreSQL recorded it as
-- applying to PUBLIC (and therefore anon). Scope it explicitly to signed-in
-- hosts before asserting that anonymous INSERT access is gone.
DROP POLICY IF EXISTS "Users create own bookings" ON public.bookings;
CREATE POLICY "Users create own bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

REVOKE INSERT ON public.bookings FROM PUBLIC, anon;
GRANT INSERT ON public.bookings TO authenticated, service_role;

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