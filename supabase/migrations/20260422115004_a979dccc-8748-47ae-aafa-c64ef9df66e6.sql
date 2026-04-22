ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS lead_source TEXT,
ADD COLUMN IF NOT EXISTS original_lead_message TEXT;