CREATE POLICY "Users manage own branding logos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'branding-logos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'branding-logos' AND auth.uid()::text = (storage.foldername(name))[1]);