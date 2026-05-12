CREATE TABLE IF NOT EXISTS public.sending_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL,
  resend_domain_id text,
  status text NOT NULL DEFAULT 'pending',
  dns_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_from_local text NOT NULL DEFAULT 'hello',
  is_default boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

ALTER TABLE public.sending_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own sending domains" ON public.sending_domains
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own sending domains" ON public.sending_domains
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own sending domains" ON public.sending_domains
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own sending domains" ON public.sending_domains
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_sending_domains_updated_at
  BEFORE UPDATE ON public.sending_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sending_domains_user ON public.sending_domains(user_id);