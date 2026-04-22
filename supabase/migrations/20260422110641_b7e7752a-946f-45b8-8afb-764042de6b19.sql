ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS lead_quality TEXT,
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;