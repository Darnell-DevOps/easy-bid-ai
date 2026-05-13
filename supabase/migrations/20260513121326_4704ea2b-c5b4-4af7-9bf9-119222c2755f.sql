CREATE TABLE public.proposal_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT,
  best_for TEXT,
  deal_size TEXT,
  tone TEXT,
  default_goals TEXT,
  default_deliverables TEXT,
  project_scope TEXT NOT NULL DEFAULT '',
  budget TEXT NOT NULL DEFAULT '',
  timeline TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  icon TEXT,
  accent TEXT,
  source TEXT NOT NULL DEFAULT 'custom',
  builtin_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX proposal_templates_user_builtin_uniq
  ON public.proposal_templates(user_id, builtin_id)
  WHERE builtin_id IS NOT NULL;

CREATE INDEX proposal_templates_user_idx ON public.proposal_templates(user_id);

ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own proposal templates"
  ON public.proposal_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own proposal templates"
  ON public.proposal_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own proposal templates"
  ON public.proposal_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own proposal templates"
  ON public.proposal_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_proposal_templates_updated_at
  BEFORE UPDATE ON public.proposal_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();