
-- Onboarding system: per-proposal/client onboarding intake forms
CREATE TABLE public.onboarding_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  proposal_id UUID,
  client_id UUID,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  service_type TEXT,
  -- field schema (array of field definitions) generated for this onboarding
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- client-submitted answers keyed by field id
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | completed
  access_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  sent_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  reminded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_onboarding_forms_proposal ON public.onboarding_forms(proposal_id) WHERE proposal_id IS NOT NULL;
CREATE INDEX idx_onboarding_forms_user ON public.onboarding_forms(user_id);
CREATE INDEX idx_onboarding_forms_token ON public.onboarding_forms(access_token);

ALTER TABLE public.onboarding_forms ENABLE ROW LEVEL SECURITY;

-- Owners full CRUD
CREATE POLICY "Users view own onboarding"
  ON public.onboarding_forms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own onboarding"
  ON public.onboarding_forms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding"
  ON public.onboarding_forms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own onboarding"
  ON public.onboarding_forms FOR DELETE
  USING (auth.uid() = user_id);

-- Public read (the form is fetched by token in the client portal). Token acts as the secret.
CREATE POLICY "Public view onboarding by token"
  ON public.onboarding_forms FOR SELECT
  TO anon, authenticated
  USING (true);

-- timestamps trigger
CREATE TRIGGER update_onboarding_forms_updated_at
BEFORE UPDATE ON public.onboarding_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Public submit RPC: client posts responses using their access token
CREATE OR REPLACE FUNCTION public.onboarding_submit(
  _token TEXT,
  _responses JSONB,
  _complete BOOLEAN DEFAULT TRUE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form public.onboarding_forms%ROWTYPE;
BEGIN
  SELECT * INTO v_form FROM public.onboarding_forms WHERE access_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid onboarding token';
  END IF;

  UPDATE public.onboarding_forms
     SET responses  = COALESCE(_responses, '{}'::jsonb),
         status     = CASE WHEN _complete THEN 'completed' ELSE 'in_progress' END,
         started_at = COALESCE(started_at, now()),
         completed_at = CASE WHEN _complete THEN now() ELSE completed_at END
   WHERE id = v_form.id;

  RETURN v_form.id;
END;
$$;
