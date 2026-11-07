-- Anonymous clients can record only aggregate events, without arbitrary IDs,
-- dates, referrers, session identifiers, query strings or metadata.
REVOKE INSERT ON public.landing_events FROM PUBLIC, anon, authenticated;
GRANT INSERT (event, path, meta) ON public.landing_events TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can record landing events" ON public.landing_events;
DROP POLICY IF EXISTS "Anyone can record valid landing events" ON public.landing_events;
CREATE POLICY "Anyone can record aggregate landing events"
ON public.landing_events FOR INSERT TO anon, authenticated
WITH CHECK (
  referrer IS NULL AND session_id IS NULL AND (
    (event IN ('landing_view', 'demo_start', 'demo_complete') AND path = '/' AND meta = '{}'::jsonb)
    OR (event IN ('signup_view', 'signup_submit_success') AND path = '/signup' AND meta = '{}'::jsonb)
    OR (event = 'sample_view' AND path = '/sample' AND meta = '{}'::jsonb)
    OR (event = 'cta_click' AND path = '/' AND meta IN (
      '{"location":"hero"}'::jsonb, '{"location":"pricing_free"}'::jsonb,
      '{"location":"pricing_starter"}'::jsonb, '{"location":"pricing_pro"}'::jsonb,
      '{"location":"footer"}'::jsonb
    ))
  )
);
