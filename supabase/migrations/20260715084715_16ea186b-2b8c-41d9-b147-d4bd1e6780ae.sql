CREATE OR REPLACE FUNCTION public.tg_booking_advance_kickoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.proposal_id IS NOT NULL AND COALESCE(NEW.status, '') <> 'cancelled' THEN
    UPDATE public.clients
       SET project_stage = 'kickoff_scheduled'
     WHERE project_stage_proposal_id = NEW.proposal_id
       AND project_stage = 'ready_for_kickoff';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_advance_kickoff ON public.bookings;
CREATE TRIGGER trg_booking_advance_kickoff
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_booking_advance_kickoff();