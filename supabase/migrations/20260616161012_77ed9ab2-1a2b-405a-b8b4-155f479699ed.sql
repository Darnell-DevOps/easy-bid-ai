
-- whatsapp_settings: per-user config
CREATE TABLE public.whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  whatsapp_from TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  auto_proposal_reminders BOOLEAN NOT NULL DEFAULT false,
  auto_payment_reminders BOOLEAN NOT NULL DEFAULT false,
  auto_contract_reminders BOOLEAN NOT NULL DEFAULT false,
  auto_onboarding_reminders BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own whatsapp settings"
ON public.whatsapp_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_settings_updated_at
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- whatsapp_send_log: history of sends
CREATE TABLE public.whatsapp_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  body TEXT NOT NULL,
  context TEXT,
  related_id UUID,
  twilio_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_send_log_user_id_idx ON public.whatsapp_send_log(user_id, sent_at DESC);
CREATE INDEX whatsapp_send_log_related_idx ON public.whatsapp_send_log(related_id) WHERE related_id IS NOT NULL;

GRANT SELECT ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own whatsapp send log"
ON public.whatsapp_send_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add channel to proposal_follow_ups for email/whatsapp tracking
ALTER TABLE public.proposal_follow_ups
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';
