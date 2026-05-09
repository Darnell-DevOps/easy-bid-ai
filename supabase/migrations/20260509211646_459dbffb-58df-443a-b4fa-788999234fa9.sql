
-- Per-user inbound email aliases
CREATE TABLE IF NOT EXISTS public.user_inbound_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE DEFAULT lower(encode(extensions.gen_random_bytes(6), 'hex')),
  inbound_secret TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  notify_digest BOOLEAN NOT NULL DEFAULT true,
  last_inbound_at TIMESTAMP WITH TIME ZONE,
  last_digest_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_inbound_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own inbound alias"
  ON public.user_inbound_aliases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own inbound alias"
  ON public.user_inbound_aliases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_inbound_aliases_updated_at
  BEFORE UPDATE ON public.user_inbound_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add inbound-related fields to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_inbound_subject TEXT,
  ADD COLUMN IF NOT EXISTS lead_inbound_from_email TEXT,
  ADD COLUMN IF NOT EXISTS lead_draft_reply TEXT,
  ADD COLUMN IF NOT EXISTS lead_draft_subject TEXT,
  ADD COLUMN IF NOT EXISTS unread_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_clients_unread_at ON public.clients (user_id, unread_at) WHERE unread_at IS NOT NULL;

-- Auto-provision inbound alias on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_inbound_alias()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_inbound_aliases (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created_inbound_alias ON auth.users;
CREATE TRIGGER on_auth_user_created_inbound_alias
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_inbound_alias();

-- Backfill aliases for existing users
INSERT INTO public.user_inbound_aliases (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- RPC to lookup user_id from slug (used by webhook with service role; helper for indexes/joins)
CREATE OR REPLACE FUNCTION public.inbound_alias_lookup(_slug TEXT)
RETURNS TABLE(user_id UUID, inbound_secret TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, inbound_secret FROM public.user_inbound_aliases WHERE slug = _slug LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.inbound_alias_lookup(TEXT) FROM PUBLIC;
