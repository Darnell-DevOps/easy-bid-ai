
-- review_requests
DROP POLICY IF EXISTS "Public view review requests by token" ON public.review_requests;
REVOKE SELECT ON public.review_requests FROM anon;

CREATE OR REPLACE FUNCTION public.public_get_review_request_by_token(_token text)
RETURNS SETOF public.review_requests
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.review_requests WHERE token = _token LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_review_request_by_token(text) TO anon, authenticated;

-- custom_domains
DROP POLICY IF EXISTS "Public read verified domains" ON public.custom_domains;
REVOKE SELECT ON public.custom_domains FROM anon;

CREATE OR REPLACE FUNCTION public.public_get_verified_domain(_domain text)
RETURNS SETOF public.custom_domains
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.custom_domains WHERE domain = _domain AND verified = true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_verified_domain(text) TO anon, authenticated;

-- lead_forms
DROP POLICY IF EXISTS "Public read active lead_forms" ON public.lead_forms;
REVOKE SELECT ON public.lead_forms FROM anon;

CREATE OR REPLACE FUNCTION public.public_get_lead_form_by_slug(_slug text)
RETURNS SETOF public.lead_forms
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.lead_forms WHERE slug = _slug AND is_active = true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_lead_form_by_slug(text) TO anon, authenticated;
