ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fit_score integer,
  ADD COLUMN IF NOT EXISTS fit_factors jsonb;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_fit_score_range;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_fit_score_range CHECK (fit_score IS NULL OR (fit_score >= 0 AND fit_score <= 100));