ALTER TABLE public.business_branding
  ADD COLUMN IF NOT EXISTS reply_to_pending_email text,
  ADD COLUMN IF NOT EXISTS reply_to_verification_token text,
  ADD COLUMN IF NOT EXISTS reply_to_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_to_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_to_verified_email text;

CREATE INDEX IF NOT EXISTS idx_business_branding_reply_to_token
  ON public.business_branding (reply_to_verification_token)
  WHERE reply_to_verification_token IS NOT NULL;