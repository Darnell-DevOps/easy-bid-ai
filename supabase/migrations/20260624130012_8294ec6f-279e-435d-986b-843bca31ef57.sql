
-- Rate-limit log keyed by form + fingerprint (hashed UA / client fingerprint)
CREATE TABLE IF NOT EXISTS public.lead_form_submission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.lead_form_submission_log TO service_role;

ALTER TABLE public.lead_form_submission_log ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER RPC touches this table.

CREATE INDEX IF NOT EXISTS idx_lfsl_form_fp_time
  ON public.lead_form_submission_log(form_id, fingerprint, created_at DESC);

-- Replace lead_form_submit with new signature (adds _honeypot + _fingerprint)
DROP FUNCTION IF EXISTS public.lead_form_submit(text, jsonb, text, text, text, text);

CREATE OR REPLACE FUNCTION public.lead_form_submit(
  _slug text,
  _responses jsonb,
  _name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _company text DEFAULT NULL,
  _honeypot text DEFAULT NULL,
  _fingerprint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form public.lead_forms%ROWTYPE;
  v_lead_id uuid;
  v_fp text;
  v_recent int;
BEGIN
  -- Honeypot: silently succeed without creating a lead.
  IF _honeypot IS NOT NULL AND length(trim(_honeypot)) > 0 THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT * INTO v_form FROM public.lead_forms WHERE slug = _slug AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_not_found';
  END IF;

  IF _responses IS NULL OR jsonb_typeof(_responses) <> 'object' THEN
    RAISE EXCEPTION 'invalid_responses';
  END IF;

  -- Per-form + per-fingerprint rate limit: 5 submissions / 10 minutes.
  v_fp := COALESCE(NULLIF(trim(_fingerprint), ''), 'anon');
  SELECT count(*) INTO v_recent
    FROM public.lead_form_submission_log
   WHERE form_id = v_form.id
     AND fingerprint = v_fp
     AND created_at > now() - interval '10 minutes';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.lead_form_submission_log (form_id, fingerprint)
  VALUES (v_form.id, v_fp);

  -- Best-effort cleanup of stale entries.
  DELETE FROM public.lead_form_submission_log
   WHERE created_at < now() - interval '1 day';

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

REVOKE ALL ON FUNCTION public.lead_form_submit(text, jsonb, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.lead_form_submit(text, jsonb, text, text, text, text, text, text) TO anon, authenticated;
