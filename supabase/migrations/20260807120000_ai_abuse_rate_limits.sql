-- Atomic, server-only request accounting for abuse-sensitive Edge Functions.
-- Subjects are salted hashes generated in the Edge Function runtime; raw IP
-- addresses, access tokens, and other request identifiers are never stored.
CREATE TABLE IF NOT EXISTS public.abuse_rate_limits (
  bucket TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, subject_hash),
  CHECK (length(bucket) BETWEEN 1 AND 100),
  CHECK (length(subject_hash) = 64)
);

ALTER TABLE public.abuse_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.abuse_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.abuse_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_abuse_rate_limit(
  _bucket TEXT,
  _subject_hash TEXT,
  _max_requests INTEGER,
  _window_seconds INTEGER,
  _request_cost INTEGER DEFAULT 1
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_window_started_at TIMESTAMPTZ;
BEGIN
  IF _bucket IS NULL OR length(_bucket) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid rate-limit bucket';
  END IF;
  IF _subject_hash IS NULL OR _subject_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid rate-limit subject';
  END IF;
  IF _max_requests NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'invalid rate-limit maximum';
  END IF;
  IF _window_seconds NOT BETWEEN 1 AND 604800 THEN
    RAISE EXCEPTION 'invalid rate-limit window';
  END IF;
  IF _request_cost NOT BETWEEN 1 AND _max_requests THEN
    RAISE EXCEPTION 'invalid rate-limit request cost';
  END IF;

  INSERT INTO public.abuse_rate_limits AS limits (
    bucket,
    subject_hash,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (
    _bucket,
    _subject_hash,
    now(),
    _request_cost,
    now()
  )
  ON CONFLICT (bucket, subject_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= now() - make_interval(secs => _window_seconds)
        THEN now()
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= now() - make_interval(secs => _window_seconds)
        THEN _request_cost
      ELSE least(limits.request_count + _request_cost, _max_requests + _request_cost)
    END,
    updated_at = now()
  RETURNING request_count, window_started_at
  INTO v_count, v_window_started_at;

  allowed := v_count <= _max_requests;
  remaining := greatest(_max_requests - v_count, 0);
  retry_after_seconds := greatest(
    1,
    ceil(extract(epoch FROM (
      v_window_started_at + make_interval(secs => _window_seconds) - now()
    )))::INTEGER
  );
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_abuse_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_abuse_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;
