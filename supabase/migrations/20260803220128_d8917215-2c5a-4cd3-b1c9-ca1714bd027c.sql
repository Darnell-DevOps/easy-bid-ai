ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_email_normalized text;

CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  e text;
  local_part text;
  domain_part text;
BEGIN
  IF _email IS NULL THEN RETURN NULL; END IF;
  e := lower(btrim(_email));
  IF e = '' OR position('@' in e) = 0 THEN RETURN NULL; END IF;
  local_part := split_part(e, '@', 1);
  domain_part := split_part(e, '@', 2);
  local_part := split_part(local_part, '+', 1);
  IF domain_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := replace(local_part, '.', '');
    domain_part := 'gmail.com';
  END IF;
  IF local_part = '' THEN RETURN NULL; END IF;
  RETURN local_part || '@' || domain_part;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_email(text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.tg_user_profiles_normalize_contact_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_email IS NOT NULL AND btrim(NEW.contact_email) = '' THEN
    NEW.contact_email := NULL;
  END IF;

  IF NEW.contact_email IS NOT NULL
     AND lower(NEW.contact_email) LIKE '%@privaterelay.appleid.com' THEN
    RAISE EXCEPTION 'apple_relay_contact_email_not_allowed';
  END IF;

  NEW.contact_email_normalized := public.normalize_email(NEW.contact_email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_user_profiles_normalize_contact_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_profiles_normalize_contact_email ON public.user_profiles;
CREATE TRIGGER user_profiles_normalize_contact_email
BEFORE INSERT OR UPDATE OF contact_email ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_user_profiles_normalize_contact_email();

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_contact_email_normalized_uidx
  ON public.user_profiles (contact_email_normalized)
  WHERE contact_email_normalized IS NOT NULL;