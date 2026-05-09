-- Add a reschedule token to bookings (auto-generated)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reschedule_token text NOT NULL
  DEFAULT encode(extensions.gen_random_bytes(18), 'hex');

CREATE INDEX IF NOT EXISTS bookings_reschedule_token_idx
  ON public.bookings (reschedule_token);

-- Public RPC: fetch booking + link + busy slots by reschedule token
CREATE OR REPLACE FUNCTION public.booking_reschedule_get(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_link    public.booking_links%ROWTYPE;
  v_avail   public.availability_settings%ROWTYPE;
  v_busy    jsonb;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE reschedule_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF v_booking.status = 'cancelled' THEN RAISE EXCEPTION 'cancelled'; END IF;

  IF v_booking.booking_link_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.booking_links WHERE id = v_booking.booking_link_id;
  END IF;

  SELECT * INTO v_avail FROM public.availability_settings WHERE user_id = v_booking.user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'scheduled_at', b.scheduled_at,
    'duration_minutes', b.duration_minutes
  )), '[]'::jsonb)
  INTO v_busy
  FROM public.bookings b
  WHERE b.user_id = v_booking.user_id
    AND b.id <> v_booking.id
    AND b.status <> 'cancelled'
    AND b.scheduled_at >= now();

  RETURN jsonb_build_object(
    'booking', jsonb_build_object(
      'id', v_booking.id,
      'client_name', v_booking.client_name,
      'client_email', v_booking.client_email,
      'meeting_name', v_booking.meeting_name,
      'duration_minutes', v_booking.duration_minutes,
      'scheduled_at', v_booking.scheduled_at,
      'location_type', v_booking.location_type,
      'location_details', v_booking.location_details,
      'status', v_booking.status
    ),
    'link', CASE WHEN v_link.id IS NOT NULL THEN jsonb_build_object(
      'id', v_link.id,
      'name', v_link.name,
      'description', v_link.description,
      'duration_minutes', v_link.duration_minutes,
      'available_days', v_link.available_days,
      'start_time', v_link.start_time,
      'end_time', v_link.end_time,
      'location_type', v_link.location_type,
      'custom_location', v_link.custom_location
    ) ELSE NULL END,
    'availability', jsonb_build_object(
      'buffer_minutes', COALESCE(v_avail.buffer_minutes, 15),
      'min_notice_hours', COALESCE(v_avail.min_notice_hours, 0)
    ),
    'busy', v_busy
  );
END;
$$;

-- Public RPC: apply the new scheduled time
CREATE OR REPLACE FUNCTION public.booking_reschedule(_token text, _new_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_conflict int;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE reschedule_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF v_booking.status = 'cancelled' THEN RAISE EXCEPTION 'cancelled'; END IF;
  IF _new_at IS NULL OR _new_at < now() THEN RAISE EXCEPTION 'invalid_time'; END IF;

  -- Conflict check (other bookings for same user)
  SELECT count(*) INTO v_conflict
  FROM public.bookings b
  WHERE b.user_id = v_booking.user_id
    AND b.id <> v_booking.id
    AND b.status <> 'cancelled'
    AND tstzrange(_new_at, _new_at + (v_booking.duration_minutes || ' minutes')::interval)
      && tstzrange(b.scheduled_at, b.scheduled_at + (b.duration_minutes || ' minutes')::interval);
  IF v_conflict > 0 THEN RAISE EXCEPTION 'slot_taken'; END IF;

  UPDATE public.bookings
     SET scheduled_at = _new_at,
         updated_at = now()
   WHERE id = v_booking.id;

  RETURN v_booking.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.booking_reschedule_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_reschedule(text, timestamptz) TO anon, authenticated;