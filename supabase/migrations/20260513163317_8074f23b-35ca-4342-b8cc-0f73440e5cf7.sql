
CREATE OR REPLACE FUNCTION public.tg_retainer_templates_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.retainer_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  service_type text,
  best_for text,
  default_amount_cents integer NOT NULL DEFAULT 0,
  default_currency text NOT NULL DEFAULT 'GBP',
  default_interval text NOT NULL DEFAULT 'monthly',
  default_custom_days integer,
  default_bullets text NOT NULL DEFAULT '',
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

CREATE UNIQUE INDEX retainer_templates_user_builtin_unique
  ON public.retainer_templates (user_id, builtin_id)
  WHERE builtin_id IS NOT NULL;

ALTER TABLE public.retainer_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own retainer templates"
  ON public.retainer_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own retainer templates"
  ON public.retainer_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own retainer templates"
  ON public.retainer_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own retainer templates"
  ON public.retainer_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_retainer_templates_updated_at
  BEFORE UPDATE ON public.retainer_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_retainer_templates_set_updated_at();
