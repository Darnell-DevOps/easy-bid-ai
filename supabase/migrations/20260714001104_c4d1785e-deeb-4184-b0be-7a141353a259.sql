ALTER TABLE public.proposals
  ADD COLUMN goals text,
  ADD COLUMN deliverables text,
  ADD COLUMN tax_rate numeric,
  ADD COLUMN payment_terms text;