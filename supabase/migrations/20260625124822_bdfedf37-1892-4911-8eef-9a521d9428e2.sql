
-- Inbound messages log + lead_thread column
CREATE TABLE IF NOT EXISTS public.inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alias_id uuid REFERENCES public.user_inbound_aliases(user_id) ON DELETE SET NULL,
  from_email text,
  from_name text,
  subject text,
  body_text text,
  received_at timestamptz NOT NULL DEFAULT now(),
  classification text NOT NULL DEFAULT 'needs_review' CHECK (classification IN ('lead','needs_review','ignored')),
  classification_reason text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.inbound_messages TO authenticated;
GRANT ALL ON public.inbound_messages TO service_role;

ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own inbound messages"
  ON public.inbound_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own inbound messages"
  ON public.inbound_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS inbound_messages_user_received_idx
  ON public.inbound_messages (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS inbound_messages_user_class_idx
  ON public.inbound_messages (user_id, classification);

-- lead_thread for appending follow-up emails on existing leads
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_thread jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Promote a needs_review message into a client/lead
CREATE OR REPLACE FUNCTION public.inbound_message_promote(_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.inbound_messages%ROWTYPE;
  v_client_id uuid;
BEGIN
  SELECT * INTO v_msg FROM public.inbound_messages
   WHERE id = _id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF v_msg.client_id IS NOT NULL THEN
    RETURN v_msg.client_id;
  END IF;

  -- Dedupe by email
  IF v_msg.from_email IS NOT NULL THEN
    SELECT id INTO v_client_id FROM public.clients
     WHERE user_id = v_msg.user_id
       AND lower(email) = lower(v_msg.from_email)
     LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      user_id, name, email, status, is_active, lead_source,
      original_lead_message, lead_inbound_subject, lead_inbound_from_email, unread_at
    ) VALUES (
      v_msg.user_id,
      COALESCE(NULLIF(trim(v_msg.from_name),''), split_part(COALESCE(v_msg.from_email,'Unknown'),'@',1)),
      v_msg.from_email,
      'New', true, 'Email',
      v_msg.body_text, v_msg.subject, v_msg.from_email, now()
    ) RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients
       SET lead_thread = lead_thread || jsonb_build_array(
             jsonb_build_object('subject', v_msg.subject, 'body', v_msg.body_text, 'received_at', v_msg.received_at)
           ),
           unread_at = now()
     WHERE id = v_client_id;
  END IF;

  UPDATE public.inbound_messages
     SET classification = 'lead', client_id = v_client_id
   WHERE id = _id;

  RETURN v_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.inbound_message_ignore(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inbound_messages
     SET classification = 'ignored'
   WHERE id = _id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;
