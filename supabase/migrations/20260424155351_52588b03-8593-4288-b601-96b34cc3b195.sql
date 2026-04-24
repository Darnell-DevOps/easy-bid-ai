
-- BOOKING LINKS
CREATE TABLE public.booking_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location_type TEXT NOT NULL DEFAULT 'google_meet',
  custom_location TEXT,
  available_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own booking links" ON public.booking_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public view booking links by slug" ON public.booking_links
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Users create own booking links" ON public.booking_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own booking links" ON public.booking_links
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own booking links" ON public.booking_links
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_booking_links_updated_at
  BEFORE UPDATE ON public.booking_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_booking_links_user ON public.booking_links(user_id);
CREATE INDEX idx_booking_links_slug ON public.booking_links(slug);

-- AVAILABILITY SETTINGS
CREATE TABLE public.availability_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  working_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  working_start TEXT NOT NULL DEFAULT '09:00',
  working_end TEXT NOT NULL DEFAULT '17:00',
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  min_notice_hours INTEGER NOT NULL DEFAULT 24,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.availability_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own availability" ON public.availability_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own availability" ON public.availability_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own availability" ON public.availability_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own availability" ON public.availability_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_availability_settings_updated_at
  BEFORE UPDATE ON public.availability_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  booking_link_id UUID,
  proposal_id UUID,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  meeting_name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  scheduled_at TIMESTAMPTZ NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'google_meet',
  location_details TEXT,
  client_message TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public view bookings for proposal" ON public.bookings
  FOR SELECT TO anon, authenticated USING (proposal_id IS NOT NULL);
CREATE POLICY "Users create own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public create bookings via link" ON public.bookings
  FOR INSERT TO anon, authenticated WITH CHECK (
    booking_link_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.booking_links bl
      WHERE bl.id = booking_link_id
        AND bl.user_id = bookings.user_id
        AND bl.is_active = true
    )
  );
CREATE POLICY "Users update own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bookings" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_scheduled_at ON public.bookings(scheduled_at);
CREATE INDEX idx_bookings_proposal ON public.bookings(proposal_id);
CREATE INDEX idx_bookings_link ON public.bookings(booking_link_id);
