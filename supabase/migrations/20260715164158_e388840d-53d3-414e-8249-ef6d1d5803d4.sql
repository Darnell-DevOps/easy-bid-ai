DROP FUNCTION IF EXISTS public.public_get_proposal_by_id(uuid);

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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.user_id, p.client_name, p.company_name, p.service_type,
         p.proposal_content, p.pricing_breakdown, p.project_scope, p.timeline,
         p.created_at, p.status, p.sent_at, p.viewed_at, p.accepted_at, p.paid_at,
         p.rejected_at, p.client_response_message, p.amount_cents, p.currency,
         p.client_paid, p.payment_terms, p.tax_rate, p.tax_mode
  FROM public.proposals p
  WHERE p.id = _id
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.public_get_proposal_by_id(uuid) TO anon, authenticated;