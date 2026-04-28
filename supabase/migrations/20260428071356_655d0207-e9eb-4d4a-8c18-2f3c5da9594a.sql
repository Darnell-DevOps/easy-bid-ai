CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule any previous version of this job (no-op on first run)
DO $$
BEGIN
  PERFORM cron.unschedule('retainer-recovery-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'retainer-recovery-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://avtogztwdoemxuffnwyv.supabase.co/functions/v1/retainer-recovery-cron',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dG9nenR3ZG9lbXh1ZmZud3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjMzOTIsImV4cCI6MjA5MTI5OTM5Mn0.YzBeN1hJwep-3enRTATohXbuBC0OoEMVv0KC6yRmhnw"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);