-- A receipt remains after an inbox item is removed so retries cannot recreate it.
-- Store only the provider's opaque email ID and the receipt time.
CREATE TABLE public.resend_inbound_receipts (
  email_id uuid PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resend_inbound_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resend_inbound_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.resend_inbound_receipts TO service_role;

CREATE FUNCTION public.record_resend_inbound_email(
  _email_id uuid, _alias text, _expected_owner uuid, _from_email text, _subject text, _body text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT a.user_id INTO owner_id FROM public.user_inbound_aliases AS a
    WHERE a.slug = _alias AND a.user_id = _expected_owner FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_alias'; END IF;

  INSERT INTO public.resend_inbound_receipts (email_id) VALUES (_email_id)
    ON CONFLICT (email_id) DO NOTHING;
  IF NOT FOUND THEN RETURN 'duplicate'; END IF;

  INSERT INTO public.inbound_messages (
    user_id, alias_id, from_email, subject, body_text, classification, classification_reason
  ) VALUES (
    owner_id, owner_id, left(_from_email, 254), left(_subject, 300), left(_body, 16000),
    'needs_review', 'Review this email before creating a lead.'
  );
  UPDATE public.user_inbound_aliases SET last_inbound_at = now() WHERE user_id = owner_id;
  RETURN 'stored';
END;
$$;

REVOKE ALL ON FUNCTION public.record_resend_inbound_email(uuid, text, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_resend_inbound_email(uuid, text, uuid, text, text, text)
  TO service_role;
