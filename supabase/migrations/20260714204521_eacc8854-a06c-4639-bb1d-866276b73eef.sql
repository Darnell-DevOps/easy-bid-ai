ALTER TABLE public.contracts ADD COLUMN sent_source text;

COMMENT ON COLUMN public.contracts.sent_source IS 'How the contract was sent: system (confirmed CloseSync email) or owner_manual (owner marked as sent themselves).';
