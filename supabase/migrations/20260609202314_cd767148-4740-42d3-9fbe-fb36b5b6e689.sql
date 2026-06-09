
CREATE TABLE public.ai_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  default_tone TEXT NOT NULL DEFAULT 'professional',
  proposal_length TEXT NOT NULL DEFAULT 'standard',
  proposal_style TEXT NOT NULL DEFAULT 'professional',
  contract_detail TEXT NOT NULL DEFAULT 'standard',
  contract_include_payment_terms BOOLEAN NOT NULL DEFAULT true,
  contract_include_revision_limits BOOLEAN NOT NULL DEFAULT true,
  contract_include_cancellation BOOLEAN NOT NULL DEFAULT true,
  lead_reply_tone TEXT NOT NULL DEFAULT 'friendly',
  lead_reply_length TEXT NOT NULL DEFAULT 'standard',
  email_tone TEXT NOT NULL DEFAULT 'professional',
  email_length TEXT NOT NULL DEFAULT 'standard',
  business_what_you_do TEXT,
  business_services TEXT,
  business_target_audience TEXT,
  business_ideal_client TEXT,
  custom_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_preferences TO authenticated;
GRANT ALL ON public.ai_preferences TO service_role;

ALTER TABLE public.ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai prefs"
ON public.ai_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ai_preferences_updated_at
BEFORE UPDATE ON public.ai_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
