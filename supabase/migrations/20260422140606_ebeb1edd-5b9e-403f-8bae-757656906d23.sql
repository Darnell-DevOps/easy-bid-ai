-- Drop the overly permissive public update policy
DROP POLICY IF EXISTS "Public can respond to proposals via link" ON public.proposals;

-- Secure RPC for client portal actions
CREATE OR REPLACE FUNCTION public.client_portal_respond(
  _proposal_id uuid,
  _action text,            -- 'view' | 'accept' | 'reject'
  _message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _action NOT IN ('view','accept','reject') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  IF _action = 'view' THEN
    UPDATE public.proposals
       SET viewed_at = COALESCE(viewed_at, now()),
           status = CASE
             WHEN status IN ('draft','sent') THEN 'viewed'
             ELSE status
           END
     WHERE id = _proposal_id;
  ELSIF _action = 'accept' THEN
    UPDATE public.proposals
       SET status = 'accepted',
           accepted_at = COALESCE(accepted_at, now()),
           rejected_at = NULL,
           client_response_message = COALESCE(_message, client_response_message)
     WHERE id = _proposal_id;
  ELSIF _action = 'reject' THEN
    UPDATE public.proposals
       SET status = 'rejected',
           rejected_at = COALESCE(rejected_at, now()),
           accepted_at = NULL,
           client_response_message = COALESCE(_message, client_response_message)
     WHERE id = _proposal_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_portal_respond(uuid, text, text) TO anon, authenticated;
