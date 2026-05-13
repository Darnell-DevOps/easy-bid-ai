
CREATE OR REPLACE FUNCTION public.tg_onboarding_templates_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.onboarding_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  service_type text,
  best_for text,
  intro text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_requests jsonb NOT NULL DEFAULT '[]'::jsonb,
  deadlines jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  icon text,
  accent text,
  source text NOT NULL DEFAULT 'custom',
  builtin_id text,
  is_default boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX onboarding_templates_user_builtin_unique
  ON public.onboarding_templates (user_id, builtin_id)
  WHERE builtin_id IS NOT NULL;

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding templates"
  ON public.onboarding_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own onboarding templates"
  ON public.onboarding_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding templates"
  ON public.onboarding_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own onboarding templates"
  ON public.onboarding_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_onboarding_templates_set_updated_at();
