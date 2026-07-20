ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_client_id UUID,
  ADD COLUMN IF NOT EXISTS onboarding_proposal_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_onboarding_step_check'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_onboarding_step_check
      CHECK (onboarding_step IN ('welcome', 'client', 'proposal', 'value', 'completed', 'skipped'));
  END IF;
END;
$$;

INSERT INTO public.user_profiles (user_id, onboarding_step, onboarding_completed_at)
SELECT active.user_id, 'completed', now()
FROM (
  SELECT user_id FROM public.clients
  UNION
  SELECT user_id FROM public.proposals
) AS active
JOIN auth.users u ON u.id = active.user_id
ON CONFLICT (user_id) DO UPDATE
SET onboarding_step = 'completed',
    onboarding_completed_at = COALESCE(
      public.user_profiles.onboarding_completed_at,
      EXCLUDED.onboarding_completed_at
    );