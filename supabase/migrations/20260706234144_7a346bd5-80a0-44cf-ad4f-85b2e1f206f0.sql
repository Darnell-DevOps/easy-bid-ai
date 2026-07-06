ALTER TABLE public.user_inbound_aliases
  ADD COLUMN IF NOT EXISTS rate_window_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS rate_window_count integer NOT NULL DEFAULT 0;