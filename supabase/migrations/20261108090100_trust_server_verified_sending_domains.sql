-- Existing rows were writable by clients. Require a new provider binding before
-- using those rows for sending or provider operations.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sending_domains FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sending_domains TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sending_domains TO service_role;

DROP POLICY IF EXISTS "users insert own sending domains" ON public.sending_domains;
DROP POLICY IF EXISTS "users update own sending domains" ON public.sending_domains;
DROP POLICY IF EXISTS "users delete own sending domains" ON public.sending_domains;

ALTER TABLE public.sending_domains ADD COLUMN provider_managed boolean NOT NULL DEFAULT false;
UPDATE public.sending_domains SET status = 'pending', verified_at = NULL, is_default = false
  WHERE status = 'verified' OR verified_at IS NOT NULL OR is_default;

CREATE UNIQUE INDEX sending_domains_provider_managed_domain_idx
ON public.sending_domains (lower(domain)) WHERE provider_managed;
