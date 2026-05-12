
CREATE TABLE public.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'upcoming',
  client_id UUID,
  client_name TEXT,
  proposal_id UUID,
  contract_id UUID,
  retainer_id UUID,
  booking_id UUID,
  onboarding_form_id UUID,
  source TEXT NOT NULL DEFAULT 'manual',
  source_key TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX deadlines_user_source_key_uniq
  ON public.deadlines (user_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX deadlines_user_due_idx ON public.deadlines (user_id, due_date);

ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deadlines" ON public.deadlines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own deadlines" ON public.deadlines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own deadlines" ON public.deadlines
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own deadlines" ON public.deadlines
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_deadlines_updated_at
BEFORE UPDATE ON public.deadlines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
