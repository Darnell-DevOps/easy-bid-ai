
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS service_requested text,
  ADD COLUMN IF NOT EXISTS budget text,
  ADD COLUMN IF NOT EXISTS timeline text,
  ADD COLUMN IF NOT EXISTS goals text,
  ADD COLUMN IF NOT EXISTS lead_quality text,
  ADD COLUMN IF NOT EXISTS ai_recommendation text,
  ADD COLUMN IF NOT EXISTS draft_reply text,
  ADD COLUMN IF NOT EXISTS draft_subject text,
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_error text;
