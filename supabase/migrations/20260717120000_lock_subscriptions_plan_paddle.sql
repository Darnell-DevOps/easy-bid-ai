-- Make Paddle the only authority for paid plan entitlements.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_price_id TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

ALTER TABLE public.subscriptions
  ALTER COLUMN plan SET DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_environment_check'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_environment_check
      CHECK (environment IS NULL OR environment IN ('sandbox', 'live'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_paddle_subscription_id
  ON public.subscriptions(paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;

-- Preview-mode accounts were provisioned as Pro without payment. Move every
-- row with no real Paddle subscription to Free before locking client writes.
UPDATE public.subscriptions
SET plan = 'free'
WHERE paddle_subscription_id IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- The DB-level proposal limiter must also fail closed when a subscription row
-- is temporarily missing.
CREATE OR REPLACE FUNCTION public.enforce_proposal_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_count int;
  v_month_start timestamptz := date_trunc('month', now());
BEGIN
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = NEW.user_id;

  IF v_plan IS NULL THEN v_plan := 'free'; END IF;

  IF v_plan = 'pro' THEN
    RETURN NEW;
  ELSIF v_plan = 'starter' THEN
    v_limit := 10;
  ELSE
    v_limit := 2;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.proposals
  WHERE user_id = NEW.user_id
    AND created_at >= v_month_start;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'proposal_limit_reached: plan % allows % proposals per month', v_plan, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users can update their own subscription plan"
  ON public.subscriptions;
REVOKE UPDATE ON public.subscriptions FROM authenticated;

-- Row owners retain SELECT through the existing RLS policy. Only service_role
-- functions can change billing identifiers or paid entitlements.
