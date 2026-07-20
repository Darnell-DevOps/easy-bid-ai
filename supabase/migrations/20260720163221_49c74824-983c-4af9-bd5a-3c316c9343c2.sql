CREATE TABLE public.app_error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('react_boundary', 'window_error', 'unhandled_rejection', 'payments_webhook')),
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'fatal')),
  message TEXT NOT NULL,
  stack TEXT,
  path TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_fingerprint TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX app_error_reports_unresolved_idx
  ON public.app_error_reports(occurred_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX app_error_reports_rate_limit_idx
  ON public.app_error_reports(request_fingerprint, occurred_at DESC)
  WHERE request_fingerprint IS NOT NULL;

ALTER TABLE public.app_error_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_error_reports TO authenticated;
GRANT ALL ON public.app_error_reports TO service_role;

CREATE POLICY "Super admins view error reports"
  ON public.app_error_reports
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.admin_resolve_error_report(_error_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.app_error_reports
  SET resolved_at = now(), resolved_by = auth.uid()
  WHERE id = _error_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_error_report(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_retry_automation_job(_job_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.automation_job_registry
  SET next_run_at = now(), last_error = NULL
  WHERE job_name = _job_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Automation job not found'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_retry_automation_job(TEXT) TO authenticated;