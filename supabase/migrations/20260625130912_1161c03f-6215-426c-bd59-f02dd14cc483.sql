
ALTER TABLE public.ai_preferences
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS booking_link text,
  ADD COLUMN IF NOT EXISTS email_signature text,
  ADD COLUMN IF NOT EXISTS lead_reply_style text NOT NULL DEFAULT 'consultative',
  ADD COLUMN IF NOT EXISTS lead_auto_send_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_auto_send_min_confidence text NOT NULL DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS lead_auto_send_only_new_leads boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lead_auto_send_block_keywords text[] NOT NULL DEFAULT ARRAY[
    'complaint','lawsuit','refund','chargeback','dispute','legal','attorney',
    'sue','court','fraud','scam','cancel','angry','urgent issue'
  ]::text[];

CREATE TABLE IF NOT EXISTS public.lead_auto_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid,
  subject text,
  body_preview text,
  confidence text,
  decision text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_auto_send_log TO authenticated;
GRANT ALL ON public.lead_auto_send_log TO service_role;

ALTER TABLE public.lead_auto_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own auto-send log"
  ON public.lead_auto_send_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lead_auto_send_log_user_created_idx
  ON public.lead_auto_send_log (user_id, created_at DESC);
