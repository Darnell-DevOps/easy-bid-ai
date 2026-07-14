-- Add default tax mode preference to business branding
ALTER TABLE public.business_branding
  ADD COLUMN IF NOT EXISTS default_tax_mode text;

COMMENT ON COLUMN public.business_branding.default_tax_mode IS
  'User default tax mode: none | exclusive | inclusive. NULL means not configured.';

-- Add tax mode snapshot to proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS tax_mode text;

COMMENT ON COLUMN public.proposals.tax_mode IS
  'Tax mode used at generation time: none | exclusive | inclusive. NULL means unset or legacy proposal.';
