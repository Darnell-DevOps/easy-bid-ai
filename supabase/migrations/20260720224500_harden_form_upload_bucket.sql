-- Enforce the upload policy at the Storage API boundary so callers cannot
-- bypass the signing function by changing the Content-Type on the PUT request.
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
