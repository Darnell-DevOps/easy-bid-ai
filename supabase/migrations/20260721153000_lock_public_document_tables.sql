-- Public proposal and contract pages must go through the scoped SECURITY
-- DEFINER functions below. Anonymous callers never need direct table access.

-- Defense in depth for databases that may have missed the earlier policy cleanup.
DROP POLICY IF EXISTS "Public can view proposals via link" ON public.proposals;
DROP POLICY IF EXISTS "Public can respond to proposals via link" ON public.proposals;
DROP POLICY IF EXISTS "Public view contracts via token" ON public.contracts;
DROP POLICY IF EXISTS "Public view signatures" ON public.contract_signatures;

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.proposals FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.contracts FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.contract_signatures FROM PUBLIC, anon;

-- Preserve the proposal portal response shape while excluding soft-deleted rows.
CREATE OR REPLACE FUNCTION public.public_get_proposal_by_id(_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  client_name text,
  company_name text,
  service_type text,
  proposal_content text,
  pricing_breakdown text,
  project_scope text,
  timeline text,
  created_at timestamptz,
  status text,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  client_response_message text,
  amount_cents integer,
  currency text,
  client_paid boolean,
  payment_terms text,
  tax_rate numeric,
  tax_mode text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.client_name, p.company_name, p.service_type,
         p.proposal_content, p.pricing_breakdown, p.project_scope, p.timeline,
         p.created_at, p.status, p.sent_at, p.viewed_at, p.accepted_at, p.paid_at,
         p.rejected_at, p.client_response_message, p.amount_cents, p.currency,
         p.client_paid, p.payment_terms, p.tax_rate, p.tax_mode
  FROM public.proposals p
  WHERE p.id = _id
    AND p.deleted_at IS NULL
  LIMIT 1;
$$;

-- A signing token grants access only to the fields required to render/sign the
-- contract. Internal retry state, deletion state, source metadata, and client
-- record identifiers are deliberately omitted.
DROP FUNCTION IF EXISTS public.public_get_contract_by_token(text);
CREATE FUNCTION public.public_get_contract_by_token(_token text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  proposal_id uuid,
  contract_type text,
  title text,
  client_name text,
  client_email text,
  company_name text,
  body text,
  status text,
  signing_token text,
  signed_at timestamptz,
  amount_cents integer,
  currency text,
  countersigned_at timestamptz,
  countersigner_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.user_id, c.proposal_id, c.contract_type, c.title,
         c.client_name, c.client_email, c.company_name, c.body, c.status,
         c.signing_token, c.signed_at, c.amount_cents, c.currency,
         c.countersigned_at, c.countersigner_name
  FROM public.contracts c
  WHERE c.signing_token = _token
    AND c.deleted_at IS NULL
  LIMIT 1;
$$;

-- Signature evidence shown on the public contract excludes captured IP address,
-- user agent, and the owner's internal user id.
DROP FUNCTION IF EXISTS public.public_get_contract_signatures_by_token(text);
CREATE FUNCTION public.public_get_contract_signatures_by_token(_token text)
RETURNS TABLE (
  id uuid,
  contract_id uuid,
  signer_name text,
  signer_email text,
  method text,
  signature_data text,
  signed_at timestamptz,
  signer_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.contract_id, s.signer_name, s.signer_email, s.method,
         s.signature_data, s.signed_at, s.signer_role
  FROM public.contract_signatures s
  JOIN public.contracts c ON c.id = s.contract_id
  WHERE c.signing_token = _token
    AND c.deleted_at IS NULL
  ORDER BY s.signed_at ASC;
$$;

-- CREATE OR REPLACE and DROP/CREATE migrations can restore PostgreSQL's default
-- PUBLIC execute grant. Pin the public lookup functions to the intended roles.
REVOKE ALL ON FUNCTION public.public_get_proposal_by_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_get_contract_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_get_contract_for_proposal(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_get_contract_signatures_by_token(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_get_proposal_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_contract_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_contract_for_proposal(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_contract_signatures_by_token(text) TO anon, authenticated;

-- Fail the migration if the final schema exposes either table-wide anonymous
-- policies or direct anonymous reads. This turns the access boundary into a
-- launch-check invariant rather than relying on migration review alone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN ('proposals', 'contracts', 'contract_signatures')
      AND (
        'anon' = ANY (p.roles)
        OR 'public' = ANY (p.roles)
      )
      AND (
        lower(btrim(COALESCE(p.qual, ''), '() ')) = 'true'
        OR lower(btrim(COALESCE(p.with_check, ''), '() ')) = 'true'
      )
  ) THEN
    RAISE EXCEPTION 'Wide-open anonymous proposal/contract policy remains';
  END IF;

  IF has_table_privilege('anon', 'public.proposals', 'SELECT')
     OR has_table_privilege('anon', 'public.contracts', 'SELECT')
     OR has_table_privilege('anon', 'public.contract_signatures', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous direct document read privilege remains';
  END IF;

  IF NOT has_function_privilege(
      'anon', 'public.public_get_proposal_by_id(uuid)', 'EXECUTE'
    )
    OR NOT has_function_privilege(
      'anon', 'public.public_get_contract_by_token(text)', 'EXECUTE'
    )
    OR NOT has_function_privilege(
      'anon', 'public.public_get_contract_for_proposal(uuid)', 'EXECUTE'
    )
    OR NOT has_function_privilege(
      'anon', 'public.public_get_contract_signatures_by_token(text)', 'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'Required public document lookup RPC is not executable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'public.public_get_proposal_by_id(uuid)'::regprocedure,
      'public.public_get_contract_by_token(text)'::regprocedure,
      'public.public_get_contract_for_proposal(uuid)'::regprocedure,
      'public.public_get_contract_signatures_by_token(text)'::regprocedure
    ]) AS target(function_oid)
    JOIN pg_proc procedure_definition
      ON procedure_definition.oid = target.function_oid
    CROSS JOIN LATERAL aclexplode(
      COALESCE(
        procedure_definition.proacl,
        acldefault('f', procedure_definition.proowner)
      )
    ) AS exploded_acl
    WHERE exploded_acl.grantee = 0
      AND exploded_acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Public document lookup RPC still grants execute to PUBLIC';
  END IF;
END;
$$;
