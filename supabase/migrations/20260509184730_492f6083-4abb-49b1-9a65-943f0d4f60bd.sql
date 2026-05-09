
-- ============ TABLES ============
CREATE TABLE public.testimonial_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  public_slug TEXT NOT NULL UNIQUE DEFAULT lower(encode(gen_random_bytes(6), 'hex')),
  wall_headline TEXT DEFAULT 'What clients say',
  wall_intro TEXT,
  google_review_url TEXT,
  auto_request_on_contract_signed BOOLEAN NOT NULL DEFAULT true,
  auto_request_on_proposal_paid BOOLEAN NOT NULL DEFAULT true,
  follow_up_days INT NOT NULL DEFAULT 4,
  max_reminders INT NOT NULL DEFAULT 2,
  from_name TEXT,
  custom_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  contract_id UUID,
  proposal_id UUID,
  source TEXT NOT NULL DEFAULT 'manual', -- manual | contract_signed | proposal_paid
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | completed | declined | expired
  sent_at TIMESTAMPTZ,
  last_reminder_at TIMESTAMPTZ,
  reminder_count INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  testimonial_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  request_id UUID,
  client_id UUID,
  client_name TEXT NOT NULL,
  client_email TEXT,
  company TEXT,
  role_title TEXT,
  rating INT,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'collected', -- collected | manual | imported | google
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  allow_public BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_requests_user ON public.review_requests(user_id);
CREATE INDEX idx_review_requests_status ON public.review_requests(status);
CREATE INDEX idx_testimonials_user ON public.testimonials(user_id);
CREATE INDEX idx_testimonials_published ON public.testimonials(user_id, is_published);

-- ============ RLS ============
ALTER TABLE public.testimonial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- testimonial_settings: owners full access; public read by slug for wall
CREATE POLICY "Owners view own testimonial settings" ON public.testimonial_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert own testimonial settings" ON public.testimonial_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own testimonial settings" ON public.testimonial_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete own testimonial settings" ON public.testimonial_settings FOR DELETE USING (auth.uid() = user_id);

-- review_requests: owners full; public select via token
CREATE POLICY "Owners view own review requests" ON public.review_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert own review requests" ON public.review_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own review requests" ON public.review_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete own review requests" ON public.review_requests FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public view review requests by token" ON public.review_requests FOR SELECT TO anon, authenticated USING (true);

-- testimonials: owners full
CREATE POLICY "Owners view own testimonials" ON public.testimonials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert own testimonials" ON public.testimonials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own testimonials" ON public.testimonials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete own testimonials" ON public.testimonials FOR DELETE USING (auth.uid() = user_id);

-- ============ TRIGGERS for updated_at ============
CREATE TRIGGER trg_testimonial_settings_updated BEFORE UPDATE ON public.testimonial_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_review_requests_updated BEFORE UPDATE ON public.review_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_testimonials_updated BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTO-CREATE REVIEW REQUESTS ============
-- When contract status flips to 'signed'
CREATE OR REPLACE FUNCTION public.auto_request_review_on_contract_signed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enabled BOOLEAN;
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') AND NEW.client_email IS NOT NULL THEN
    SELECT auto_request_on_contract_signed INTO v_enabled
      FROM public.testimonial_settings WHERE user_id = NEW.user_id;
    IF COALESCE(v_enabled, true) THEN
      INSERT INTO public.review_requests (user_id, client_id, client_name, client_email, contract_id, source)
      VALUES (NEW.user_id, NEW.client_id, NEW.client_name, NEW.client_email, NEW.id, 'contract_signed');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_auto_review_contract_signed
AFTER UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.auto_request_review_on_contract_signed();

-- When proposal becomes paid
CREATE OR REPLACE FUNCTION public.auto_request_review_on_proposal_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enabled BOOLEAN; v_email TEXT;
BEGIN
  IF NEW.client_paid = true AND COALESCE(OLD.client_paid, false) = false THEN
    SELECT auto_request_on_proposal_paid INTO v_enabled
      FROM public.testimonial_settings WHERE user_id = NEW.user_id;
    IF COALESCE(v_enabled, true) THEN
      SELECT email INTO v_email FROM public.clients WHERE id = NEW.client_id;
      IF v_email IS NOT NULL THEN
        INSERT INTO public.review_requests (user_id, client_id, client_name, client_email, proposal_id, source)
        VALUES (NEW.user_id, NEW.client_id, NEW.client_name, v_email, NEW.id, 'proposal_paid');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_auto_review_proposal_paid
AFTER UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.auto_request_review_on_proposal_paid();

-- ============ PUBLIC RPCs ============
CREATE OR REPLACE FUNCTION public.testimonial_request_get(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.review_requests%ROWTYPE; v_set public.testimonial_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.review_requests WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  SELECT * INTO v_set FROM public.testimonial_settings WHERE user_id = v_req.user_id;
  RETURN jsonb_build_object(
    'id', v_req.id,
    'client_name', v_req.client_name,
    'status', v_req.status,
    'from_name', COALESCE(v_set.from_name, ''),
    'custom_message', COALESCE(v_set.custom_message, ''),
    'google_review_url', COALESCE(v_set.google_review_url, '')
  );
END; $$;

CREATE OR REPLACE FUNCTION public.testimonial_submit(
  _token TEXT, _rating INT, _content TEXT, _client_name TEXT,
  _company TEXT DEFAULT NULL, _role_title TEXT DEFAULT NULL,
  _allow_public BOOLEAN DEFAULT true
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.review_requests%ROWTYPE; v_id UUID;
BEGIN
  SELECT * INTO v_req FROM public.review_requests WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF v_req.status = 'completed' THEN RAISE EXCEPTION 'already_submitted'; END IF;
  IF length(coalesce(_content,'')) < 5 THEN RAISE EXCEPTION 'content_too_short'; END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'invalid_rating'; END IF;

  INSERT INTO public.testimonials
    (user_id, request_id, client_id, client_name, client_email, company, role_title, rating, content, source, allow_public, is_published)
  VALUES
    (v_req.user_id, v_req.id, v_req.client_id, _client_name, v_req.client_email, _company, _role_title, _rating, _content, 'collected', _allow_public, _allow_public)
  RETURNING id INTO v_id;

  UPDATE public.review_requests
    SET status = 'completed', completed_at = now(), testimonial_id = v_id
    WHERE id = v_req.id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.testimonial_wall_get(_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_set public.testimonial_settings%ROWTYPE; v_items JSONB;
BEGIN
  SELECT * INTO v_set FROM public.testimonial_settings WHERE public_slug = _slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'client_name', t.client_name,
    'company', t.company,
    'role_title', t.role_title,
    'rating', t.rating,
    'content', t.content,
    'is_featured', t.is_featured,
    'avatar_url', t.avatar_url,
    'created_at', t.created_at
  ) ORDER BY t.is_featured DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.testimonials t
   WHERE t.user_id = v_set.user_id
     AND t.is_published = true
     AND t.allow_public = true;
  RETURN jsonb_build_object(
    'headline', v_set.wall_headline,
    'intro', v_set.wall_intro,
    'google_review_url', v_set.google_review_url,
    'from_name', v_set.from_name,
    'testimonials', v_items
  );
END; $$;
