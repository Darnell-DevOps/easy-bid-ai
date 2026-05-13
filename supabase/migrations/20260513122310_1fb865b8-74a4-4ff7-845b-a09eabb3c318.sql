CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'service_agreement',
  service_type TEXT,
  best_for TEXT,
  default_scope TEXT NOT NULL DEFAULT '',
  default_timeline TEXT NOT NULL DEFAULT '',
  default_budget TEXT NOT NULL DEFAULT '',
  default_payment_terms TEXT NOT NULL DEFAULT '50% deposit, 50% on completion',
  extra_clauses TEXT NOT NULL DEFAULT '',
  icon TEXT,
  accent TEXT,
  source TEXT NOT NULL DEFAULT 'custom',
  builtin_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contract_templates_user_builtin_uniq
  ON public.contract_templates(user_id, builtin_id)
  WHERE builtin_id IS NOT NULL;

CREATE INDEX contract_templates_user_idx ON public.contract_templates(user_id);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own contract templates"
  ON public.contract_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own contract templates"
  ON public.contract_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own contract templates"
  ON public.contract_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own contract templates"
  ON public.contract_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();