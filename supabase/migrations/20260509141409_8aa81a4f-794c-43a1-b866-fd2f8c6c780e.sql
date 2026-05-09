CREATE TABLE public.landing_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  session_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_landing_events_created_at ON public.landing_events (created_at DESC);
CREATE INDEX idx_landing_events_event ON public.landing_events (event);

ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;

-- Anonymous + authenticated visitors can log events (insert-only).
CREATE POLICY "Anyone can record landing events"
ON public.landing_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No SELECT/UPDATE/DELETE policies → only service role can read/modify.
