ALTER TABLE public.business_branding 
  ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS email_signature TEXT;