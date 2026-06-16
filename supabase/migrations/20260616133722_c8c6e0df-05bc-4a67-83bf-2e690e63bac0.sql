
-- Add intake response storage on clients so converted leads carry their form answers forward
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS intake_responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS intake_form_id uuid;

-- Re-create converter to also copy the structured responses + form id
CREATE OR REPLACE FUNCTION public.lead_convert_to_client(_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id uuid;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found'; END IF;
  IF v_lead.client_id IS NOT NULL THEN RETURN v_lead.client_id; END IF;

  INSERT INTO public.clients (
    user_id, name, email, phone, company, lead_source, status,
    project_description, original_lead_message,
    intake_responses, intake_form_id
  ) VALUES (
    v_lead.user_id,
    COALESCE(NULLIF(trim(coalesce(v_lead.name,'')), ''), 'New lead'),
    v_lead.email, v_lead.phone, v_lead.company,
    COALESCE(v_lead.source, 'form'), 'New',
    NULL,
    (SELECT string_agg(key || ': ' || value, E'\n') FROM jsonb_each_text(v_lead.responses)),
    COALESCE(v_lead.responses, '{}'::jsonb),
    v_lead.form_id
  ) RETURNING id INTO v_client_id;

  UPDATE public.leads
     SET client_id = v_client_id, status = 'converted'
   WHERE id = _lead_id;

  RETURN v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_convert_to_client(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.lead_convert_to_client(uuid) TO authenticated;

-- RLS for the private form-uploads storage bucket (bucket itself is created via the storage API)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Form uploads: owner read') THEN
    CREATE POLICY "Form uploads: owner read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'form-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Form uploads: owner write') THEN
    CREATE POLICY "Form uploads: owner write"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'form-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Form uploads: owner delete') THEN
    CREATE POLICY "Form uploads: owner delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'form-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END
$$;
