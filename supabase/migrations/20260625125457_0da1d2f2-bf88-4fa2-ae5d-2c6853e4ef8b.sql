ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_score text,
  ADD COLUMN IF NOT EXISTS lead_score_reason text,
  ADD COLUMN IF NOT EXISTS missing_info text[];

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_lead_score_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_lead_score_check
  CHECK (lead_score IS NULL OR lead_score IN ('Hot','Warm','Cold','Unclear'));

UPDATE public.clients
SET lead_score = CASE lead_quality
    WHEN 'High' THEN 'Hot'
    WHEN 'Medium' THEN 'Warm'
    WHEN 'Low' THEN 'Cold'
    ELSE 'Unclear'
  END
WHERE lead_score IS NULL;