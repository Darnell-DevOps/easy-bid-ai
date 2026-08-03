-- Structured security telemetry for server-side request rejection and anomaly review.
-- Never store raw IP addresses, credentials, webhook payloads, or message contents here.
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  source TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'blocked'
    CHECK (outcome IN ('observed', 'blocked', 'failed')),
  status_code INTEGER CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_fingerprint TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_occurred_at_idx
  ON public.security_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_type_source_idx
  ON public.security_events(event_type, source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_fingerprint_idx
  ON public.security_events(request_fingerprint, occurred_at DESC)
  WHERE request_fingerprint IS NOT NULL;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_events FROM anon, authenticated;
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

DROP POLICY IF EXISTS "Super admins view security events"
  ON public.security_events;
CREATE POLICY "Super admins view security events"
  ON public.security_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Returns aggregate event groups only. Raw request fingerprints remain in the
-- protected table for an administrator's targeted investigation.
CREATE OR REPLACE FUNCTION public.admin_security_event_summary(
  _since TIMESTAMPTZ DEFAULT (now() - interval '24 hours')
)
RETURNS TABLE (
  event_type TEXT,
  source TEXT,
  severity TEXT,
  event_count BIGINT,
  unique_request_fingerprints BIGINT,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    se.event_type,
    se.source,
    se.severity,
    count(*) AS event_count,
    count(DISTINCT se.request_fingerprint) AS unique_request_fingerprints,
    max(se.occurred_at) AS last_seen_at
  FROM public.security_events AS se
  WHERE se.occurred_at >= greatest(
    coalesce(_since, now() - interval '24 hours'),
    now() - interval '30 days'
  )
  GROUP BY se.event_type, se.source, se.severity
  ORDER BY event_count DESC, last_seen_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_security_event_summary(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_security_event_summary(TIMESTAMPTZ) TO authenticated;
