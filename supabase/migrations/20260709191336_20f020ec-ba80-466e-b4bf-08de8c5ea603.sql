
CREATE OR REPLACE FUNCTION public.enforce_no_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buffer int;
  v_conflict_id uuid;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT buffer_minutes INTO v_buffer
  FROM public.availability_settings
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_buffer IS NULL THEN
    v_buffer := 15;
  END IF;

  SELECT id INTO v_conflict_id
  FROM public.bookings existing
  WHERE existing.user_id = NEW.user_id
    AND existing.status <> 'cancelled'
    AND (TG_OP = 'INSERT' OR existing.id <> NEW.id)
    AND existing.scheduled_at < NEW.scheduled_at + ((NEW.duration_minutes + v_buffer) || ' minutes')::interval
    AND existing.scheduled_at + ((existing.duration_minutes + v_buffer) || ' minutes')::interval > NEW.scheduled_at
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'This time slot was just booked by someone else — please choose another time.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_no_booking_overlap_trigger ON public.bookings;
CREATE TRIGGER enforce_no_booking_overlap_trigger
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_booking_overlap();
