ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_score text,
  ADD COLUMN IF NOT EXISTS lead_score_reason text,
  ADD COLUMN IF NOT EXISTS missing_info text[];