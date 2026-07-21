-- Enforce the upload policy at the Storage API boundary so callers cannot
-- bypass the signing function by changing the Content-Type on the PUT request.
-- Lovable Cloud's migration role cannot update Storage-owned tables. In that
-- environment the deployment workflow applies this same configuration through
-- the Storage API after the migration is recorded.
DO $$
BEGIN
  IF has_table_privilege('storage.buckets', 'UPDATE') THEN
    UPDATE storage.buckets
    SET file_size_limit = 31457280,
        allowed_mime_types = ARRAY[
          'image/png',
          'image/jpeg',
          'image/webp',
          'image/gif',
          'image/avif',
          'image/bmp',
          'image/tiff',
          'image/heic',
          'image/heif',
          'image/x-icon',
          'image/vnd.microsoft.icon',
          'text/plain',
          'text/csv',
          'application/csv',
          'application/json',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/zip',
          'application/x-zip-compressed'
        ]::text[]
    WHERE id = 'form-uploads';
  ELSE
    RAISE NOTICE 'Storage bucket update deferred to the platform Storage API';
  END IF;
END;
$$;
