ALTER TABLE public.retainers
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_change jsonb;

CREATE INDEX IF NOT EXISTS idx_retainers_paddle_subscription_id
  ON public.retainers(paddle_subscription_id);