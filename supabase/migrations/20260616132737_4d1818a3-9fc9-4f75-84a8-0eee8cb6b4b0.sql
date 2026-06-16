
-- ============================================================
-- lead_forms
-- ============================================================
CREATE TABLE public.lead_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  submit_label text NOT NULL DEFAULT 'Submit',
  success_message text NOT NULL DEFAULT 'Thanks — we''ll be in touch shortly.',
  redirect_url text,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  submission_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_forms TO authenticated;
GRANT SELECT ON public.lead_forms TO anon;
GRANT ALL ON public.lead_forms TO service_role;

ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage lead_forms" ON public.lead_forms
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read active lead_forms" ON public.lead_forms
  FOR SELECT TO anon
  USING (is_active = true);

CREATE TRIGGER update_lead_forms_updated_at BEFORE UPDATE ON public.lead_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lead_forms_user ON public.lead_forms(user_id);
CREATE INDEX idx_lead_forms_slug ON public.lead_forms(slug);

-- ============================================================
-- leads
-- ============================================================
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id uuid REFERENCES public.lead_forms(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  company text,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'form',
  status text NOT NULL DEFAULT 'new',
  notes text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leads_user ON public.leads(user_id);
CREATE INDEX idx_leads_form ON public.leads(form_id);
CREATE INDEX idx_leads_status ON public.leads(user_id, status);

-- ============================================================
-- lead_form_views
-- ============================================================
CREATE TABLE public.lead_form_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent text,
  referer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_form_views TO authenticated;
GRANT ALL ON public.lead_form_views TO service_role;

ALTER TABLE public.lead_form_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their form views" ON public.lead_form_views
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_lead_form_views_form ON public.lead_form_views(form_id);

-- ============================================================
-- Public RPC: submit a lead form
-- ============================================================
CREATE OR REPLACE FUNCTION public.lead_form_submit(
  _slug text,
  _responses jsonb,
  _name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _company text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form public.lead_forms%ROWTYPE;
  v_lead_id uuid;
BEGIN
  SELECT * INTO v_form FROM public.lead_forms WHERE slug = _slug AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_not_found';
  END IF;

  IF _responses IS NULL OR jsonb_typeof(_responses) <> 'object' THEN
    RAISE EXCEPTION 'invalid_responses';
  END IF;

  INSERT INTO public.leads (user_id, form_id, name, email, phone, company, responses, source, status)
  VALUES (
    v_form.user_id, v_form.id,
    NULLIF(trim(coalesce(_name,'')), ''),
    NULLIF(trim(coalesce(_email,'')), ''),
    NULLIF(trim(coalesce(_phone,'')), ''),
    NULLIF(trim(coalesce(_company,'')), ''),
    _responses, 'form', 'new'
  ) RETURNING id INTO v_lead_id;

  UPDATE public.lead_forms
     SET submission_count = submission_count + 1
   WHERE id = v_form.id;

  INSERT INTO public.user_notifications (user_id, category, key, title, body, metadata)
  VALUES (
    v_form.user_id, 'lead', 'lead_received',
    'New lead from ' || v_form.name,
    COALESCE(NULLIF(trim(coalesce(_name,'')), ''), 'A visitor') || ' submitted your form.',
    jsonb_build_object('lead_id', v_lead_id, 'form_id', v_form.id)
  );

  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'redirect_url', v_form.redirect_url);
END;
$$;

REVOKE ALL ON FUNCTION public.lead_form_submit(text, jsonb, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.lead_form_submit(text, jsonb, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- Public RPC: record a form view
-- ============================================================
CREATE OR REPLACE FUNCTION public.lead_form_record_view(
  _slug text,
  _user_agent text DEFAULT NULL,
  _referer text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_form public.lead_forms%ROWTYPE;
BEGIN
  SELECT * INTO v_form FROM public.lead_forms WHERE slug = _slug AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.lead_form_views (form_id, user_id, user_agent, referer)
  VALUES (v_form.id, v_form.user_id, _user_agent, _referer);

  UPDATE public.lead_forms SET view_count = view_count + 1 WHERE id = v_form.id;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_form_record_view(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.lead_form_record_view(text, text, text) TO anon, authenticated;

-- ============================================================
-- Convert a lead to a client
-- ============================================================
CREATE OR REPLACE FUNCTION public.lead_convert_to_client(_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id uuid;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found'; END IF;
  IF v_lead.client_id IS NOT NULL THEN RETURN v_lead.client_id; END IF;

  INSERT INTO public.clients (
    user_id, name, email, phone, company, lead_source, status,
    project_description, original_lead_message
  ) VALUES (
    v_lead.user_id,
    COALESCE(NULLIF(trim(coalesce(v_lead.name,'')), ''), 'New lead'),
    v_lead.email, v_lead.phone, v_lead.company,
    COALESCE(v_lead.source, 'form'), 'New',
    NULL,
    (SELECT string_agg(key || ': ' || value, E'\n') FROM jsonb_each_text(v_lead.responses))
  ) RETURNING id INTO v_client_id;

  UPDATE public.leads
     SET client_id = v_client_id, status = 'converted'
   WHERE id = _lead_id;

  RETURN v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_convert_to_client(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.lead_convert_to_client(uuid) TO authenticated;
