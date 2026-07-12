ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS fit_score integer,
  ADD COLUMN IF NOT EXISTS fit_factors jsonb;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_fit_score_range;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_fit_score_range
  CHECK (fit_score IS NULL OR (fit_score BETWEEN 0 AND 100));