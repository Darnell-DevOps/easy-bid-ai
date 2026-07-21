-- Preserve fail-closed webhook authentication at the database boundary too.
-- Generated aliases already use 48-character secrets; only malformed legacy
-- rows are rotated by this backfill.
UPDATE public.user_inbound_aliases
SET inbound_secret = encode(extensions.gen_random_bytes(24), 'hex')
WHERE char_length(inbound_secret) < 32;

ALTER TABLE public.user_inbound_aliases
  DROP CONSTRAINT IF EXISTS user_inbound_aliases_inbound_secret_length;
ALTER TABLE public.user_inbound_aliases
  ADD CONSTRAINT user_inbound_aliases_inbound_secret_length
  CHECK (char_length(inbound_secret) BETWEEN 32 AND 512);