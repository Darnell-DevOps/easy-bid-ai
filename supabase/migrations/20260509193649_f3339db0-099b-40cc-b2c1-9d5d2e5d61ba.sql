ALTER TABLE public.booking_links ADD COLUMN IF NOT EXISTS meeting_url text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_url text;