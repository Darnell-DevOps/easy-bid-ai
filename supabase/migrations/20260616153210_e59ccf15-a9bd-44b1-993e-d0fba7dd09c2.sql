
-- 1. Locked-down config table for internal secrets the DB needs to read
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_config TO service_role;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions (owner) and service_role can access.

-- 2. Rewrite trigger function to read the secret from internal_config
CREATE OR REPLACE FUNCTION public.trigger_lead_qualify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text := 'https://avtogztwdoemxuffnwyv.supabase.co/functions/v1/lead-qualify';
  v_secret text;
BEGIN
  IF NEW.qualified_at IS NULL AND COALESCE(NEW.status, 'new') = 'new' THEN
    SELECT value INTO v_secret FROM public.internal_config WHERE key = 'lead_qualify_secret';
    IF v_secret IS NULL OR length(v_secret) = 0 THEN
      RAISE WARNING 'lead_qualify_secret not configured in internal_config';
      RETURN NEW;
    END IF;

    BEGIN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', v_secret
        ),
        body    := jsonb_build_object('leadId', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never block lead ingestion if the HTTP call fails
      RAISE WARNING 'lead_qualify trigger failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Attach trigger to leads (idempotent)
DROP TRIGGER IF EXISTS leads_auto_qualify ON public.leads;
CREATE TRIGGER leads_auto_qualify
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trigger_lead_qualify();
