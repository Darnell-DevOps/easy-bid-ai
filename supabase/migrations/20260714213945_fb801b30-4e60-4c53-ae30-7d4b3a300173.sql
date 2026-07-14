ALTER TABLE public.proposals
  ADD COLUMN previous_proposal_content text,
  ADD COLUMN previous_pricing_breakdown text,
  ADD COLUMN previous_invoice_content text,
  ADD COLUMN previous_content_saved_at timestamp with time zone;