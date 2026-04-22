ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS amount_cents integer,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paddle_transaction_id text;

CREATE OR REPLACE FUNCTION public.mark_proposal_paid(_proposal_id uuid, _txn_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.proposals
     SET client_paid = true,
         paid_at = COALESCE(paid_at, now()),
         paddle_transaction_id = COALESCE(paddle_transaction_id, _txn_id)
   WHERE id = _proposal_id;
END;
$$;