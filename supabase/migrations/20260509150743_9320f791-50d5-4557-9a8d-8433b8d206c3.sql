CREATE TABLE public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  template text NOT NULL,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'pending',
  provider_id text,
  error text,
  idempotency_key text UNIQUE,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_send_log_user ON public.email_send_log(user_id, created_at DESC);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log(recipient);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own email logs"
  ON public.email_send_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE public.email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.