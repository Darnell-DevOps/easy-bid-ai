-- Retainer payment recovery columns
ALTER TABLE public.retainers
  ADD COLUMN IF NOT EXISTS payment_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_recovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_recovery_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_renewal_email_at timestamptz;

-- Track which failed invoices were later recovered
ALTER TABLE public.retainer_invoices
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz;

-- Reminders queue (renewal + dunning)
CREATE TABLE IF NOT EXISTS public.retainer_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  retainer_id uuid NOT NULL,
  kind text NOT NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retainer_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_retainer_reminders_user ON public.retainer_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_retainer_reminders_retainer ON public.retainer_reminders(retainer_id);
CREATE INDEX IF NOT EXISTS idx_retainer_reminders_pending ON public.retainer_reminders(status, scheduled_for);

ALTER TABLE public.retainer_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own retainer reminders"
  ON public.retainer_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own retainer reminders"
  ON public.retainer_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own retainer reminders"
  ON public.retainer_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own retainer reminders"
  ON public.retainer_reminders FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_retainer_reminders_updated_at
  BEFORE UPDATE ON public.retainer_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();