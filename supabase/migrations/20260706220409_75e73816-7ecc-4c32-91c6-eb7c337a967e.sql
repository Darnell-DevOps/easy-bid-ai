
-- 1) Drop insecure wide-open anon SELECT policies
DROP POLICY IF EXISTS "Public view contracts via token" ON public.contracts;
DROP POLICY IF EXISTS "Public view signatures" ON public.contract_signatures;
DROP POLICY IF EXISTS "Public can view proposals via link" ON public.proposals;
DROP POLICY IF EXISTS "Public view retainers by token" ON public.retainers;

-- 2) Token/id-scoped SECURITY DEFINER lookup functions for anon (and authenticated) callers

-- Contract by signing token (used by /sign/:token)
CREATE OR REPLACE FUNCTION public.public_get_contract_by_token(_token text)
RETURNS SETOF public.contracts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.contracts WHERE signing_token = _token LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_get_contract_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_contract_by_token(text) TO anon, authenticated;

-- Contract signatures scoped to a contract signing token
CREATE OR REPLACE FUNCTION public.public_get_contract_signatures_by_token(_token text)
RETURNS SETOF public.contract_signatures
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.contract_signatures s
  JOIN public.contracts c ON c.id = s.contract_id
  WHERE c.signing_token = _token
  ORDER BY s.signed_at ASC;
$$;
REVOKE ALL ON FUNCTION public.public_get_contract_signatures_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_contract_signatures_by_token(text) TO anon, authenticated;

-- Proposal by id (used by /proposal/view/:id client portal)
CREATE OR REPLACE FUNCTION public.public_get_proposal_by_id(_id uuid)
RETURNS SETOF public.proposals
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.proposals WHERE id = _id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_get_proposal_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_proposal_by_id(uuid) TO anon, authenticated;

-- Retainer by access_token (used by /retainer/:token subscribe + /r/recover/:token)
CREATE OR REPLACE FUNCTION public.public_get_retainer_by_token(_token text)
RETURNS SETOF public.retainers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.retainers WHERE access_token = _token LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_get_retainer_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_retainer_by_token(text) TO anon, authenticated;

-- Latest contract for a proposal (used by ClientPortal to surface the sign link)
CREATE OR REPLACE FUNCTION public.public_get_contract_for_proposal(_proposal_id uuid)
RETURNS SETOF public.contracts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.contracts
   WHERE proposal_id = _proposal_id
   ORDER BY created_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_get_contract_for_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_contract_for_proposal(uuid) TO anon, authenticated;

-- Retainer access_token for a proposal (used by ContractSignPage post-sign upsell)
CREATE OR REPLACE FUNCTION public.public_get_retainer_token_for_proposal(_proposal_id uuid)
RETURNS TABLE(access_token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT access_token
    FROM public.retainers
   WHERE proposal_id = _proposal_id
   ORDER BY created_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_get_retainer_token_for_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_retainer_token_for_proposal(uuid) TO anon, authenticated;
