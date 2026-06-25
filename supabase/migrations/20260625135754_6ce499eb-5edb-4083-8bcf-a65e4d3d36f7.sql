
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verification_token TEXT NOT NULL DEFAULT ('closesync-verify=' || replace(gen_random_uuid()::text,'-','')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  use_for_portal BOOLEAN NOT NULL DEFAULT true,
  use_for_forms BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_check_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_domains_domain_unique ON public.custom_domains (lower(domain));
CREATE INDEX IF NOT EXISTS custom_domains_user_idx ON public.custom_domains (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_domains TO authenticated;
GRANT ALL ON public.custom_domains TO service_role;
GRANT SELECT ON public.custom_domains TO anon;

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own custom domains" ON public.custom_domains
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public read of verified domains only (needed so client-side can map domain -> user lookup if ever needed)
CREATE POLICY "Public read verified domains" ON public.custom_domains
  FOR SELECT TO anon USING (verified = true);

CREATE TRIGGER trg_custom_domains_updated_at
  BEFORE UPDATE ON public.custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one primary per user
CREATE OR REPLACE FUNCTION public.custom_domains_enforce_single_primary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.custom_domains
       SET is_primary = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_custom_domains_single_primary
  AFTER INSERT OR UPDATE OF is_primary ON public.custom_domains
  FOR EACH ROW WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.custom_domains_enforce_single_primary();

-- Public RPC: resolve a verified custom domain to its primary URL fields (used by share-link helpers)
CREATE OR REPLACE FUNCTION public.get_primary_custom_domain(p_user_id uuid)
RETURNS TABLE(domain text, use_for_portal boolean, use_for_forms boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT domain, use_for_portal, use_for_forms
  FROM public.custom_domains
  WHERE user_id = p_user_id AND verified = true AND is_primary = true
  LIMIT 1;
$$;
