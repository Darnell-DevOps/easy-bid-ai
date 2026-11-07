-- A missing or unrecognised setting keeps unscanned form attachments paused.
CREATE OR REPLACE FUNCTION public.form_attachments_available()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_config
    WHERE key = 'form_attachments_enabled' AND value = 'true'
  );
$$;

REVOKE ALL ON FUNCTION public.form_attachments_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_attachments_available() TO anon, authenticated, service_role;

-- The signing functions also check the flag because the service role bypasses RLS.
CREATE POLICY "Require form attachments enabled for reads"
ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (bucket_id <> 'form-uploads' OR (SELECT public.form_attachments_available()));

CREATE POLICY "Require form attachments enabled for inserts"
ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id <> 'form-uploads' OR (SELECT public.form_attachments_available()));

CREATE POLICY "Require form attachments enabled for updates"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (bucket_id <> 'form-uploads' OR (SELECT public.form_attachments_available()))
WITH CHECK (bucket_id <> 'form-uploads' OR (SELECT public.form_attachments_available()));
