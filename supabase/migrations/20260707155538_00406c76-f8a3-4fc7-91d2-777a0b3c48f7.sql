
-- 1) subscriptions table
CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'pro' CHECK (plan IN ('free','starter','pro')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription plan"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- keep updated_at fresh
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Auto-provision a 'pro' subscription for every new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan)
  VALUES (NEW.id, 'pro')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill existing users
INSERT INTO public.subscriptions (user_id, plan)
SELECT u.id, 'pro' FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- 3) Defense-in-depth: enforce monthly proposal limits at DB level.
-- NOTE: These limits mirror src/lib/plans.ts (free=2, starter=10, pro=unlimited).
-- Keep in sync with that file until plan limits are unified in one place.
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
  SELECT plan INTO v_plan FROM public.subscriptions WHERE user_id = NEW.user_id;
  IF v_plan IS NULL THEN v_plan := 'pro'; END IF;

  IF v_plan = 'pro' THEN
    RETURN NEW; -- unlimited
  ELSIF v_plan = 'starter' THEN
    v_limit := 10;
  ELSE
    v_limit := 2; -- free
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

CREATE TRIGGER proposals_enforce_plan_limit
  BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_plan_limit();
