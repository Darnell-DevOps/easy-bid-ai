
-- Role enum and table
CREATE TYPE public.app_role AS ENUM ('super_admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- has_role (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role)
$$;

-- Super admin SELECT policies (additive — existing per-user policies untouched)
CREATE POLICY "Super admins read all clients" ON public.clients
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all proposals" ON public.proposals
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all contracts" ON public.contracts
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all bookings" ON public.bookings
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all retainers" ON public.retainers
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all retainer_invoices" ON public.retainer_invoices
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all onboarding_forms" ON public.onboarding_forms
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all email_send_log" ON public.email_send_log
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins read all ai_insights" ON public.ai_insights
  FOR SELECT USING (public.is_super_admin());

-- Reporting RPCs (gated to super admin)
CREATE OR REPLACE FUNCTION public.admin_user_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH signups AS (
    SELECT date_trunc('day', created_at) AS day, count(*)::int AS c
    FROM auth.users
    WHERE created_at > now() - interval '90 days'
    GROUP BY 1 ORDER BY 1
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM auth.users) AS total,
      (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '24 hours') AS d1,
      (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days') AS d7,
      (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days') AS d30
  ),
  active AS (
    SELECT
      (SELECT count(DISTINCT user_id) FROM (
        SELECT user_id FROM proposals WHERE updated_at > now() - interval '7 days'
        UNION ALL SELECT user_id FROM clients WHERE updated_at > now() - interval '7 days'
        UNION ALL SELECT user_id FROM contracts WHERE updated_at > now() - interval '7 days'
      ) u) AS w1,
      (SELECT count(DISTINCT user_id) FROM (
        SELECT user_id FROM proposals WHERE updated_at > now() - interval '30 days'
        UNION ALL SELECT user_id FROM clients WHERE updated_at > now() - interval '30 days'
        UNION ALL SELECT user_id FROM contracts WHERE updated_at > now() - interval '30 days'
      ) u) AS m1
  )
  SELECT jsonb_build_object(
    'total_users', (SELECT total FROM totals),
    'new_24h', (SELECT d1 FROM totals),
    'new_7d', (SELECT d7 FROM totals),
    'new_30d', (SELECT d30 FROM totals),
    'active_7d', (SELECT w1 FROM active),
    'active_30d', (SELECT m1 FROM active),
    'signups_daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', day, 'count', c)) FROM signups), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revenue_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH proposal_rev AS (
    SELECT
      COALESCE(SUM(amount_cents),0)::bigint AS total_cents,
      count(*)::int AS paid_count
    FROM proposals WHERE client_paid = true
  ),
  retainer_rev AS (
    SELECT
      COALESCE(SUM(amount_cents),0)::bigint AS total_cents,
      count(*)::int AS paid_count
    FROM retainer_invoices WHERE status = 'paid'
  ),
  monthly AS (
    SELECT date_trunc('month', paid_at) AS month, SUM(amount_cents)::bigint AS cents
    FROM (
      SELECT paid_at, amount_cents FROM proposals WHERE client_paid = true AND paid_at IS NOT NULL
      UNION ALL
      SELECT paid_at, amount_cents FROM retainer_invoices WHERE status = 'paid' AND paid_at IS NOT NULL
    ) all_pay
    WHERE paid_at > now() - interval '12 months'
    GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'proposal_revenue_cents', (SELECT total_cents FROM proposal_rev),
    'proposal_paid_count', (SELECT paid_count FROM proposal_rev),
    'retainer_revenue_cents', (SELECT total_cents FROM retainer_rev),
    'retainer_paid_count', (SELECT paid_count FROM retainer_rev),
    'monthly', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'cents', cents)) FROM monthly), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_usage_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'proposals_total', (SELECT count(*) FROM proposals),
    'proposals_sent', (SELECT count(*) FROM proposals WHERE status IN ('sent','viewed','accepted','rejected')),
    'proposals_accepted', (SELECT count(*) FROM proposals WHERE status = 'accepted'),
    'proposals_paid', (SELECT count(*) FROM proposals WHERE client_paid = true),
    'contracts_total', (SELECT count(*) FROM contracts),
    'contracts_signed', (SELECT count(*) FROM contracts WHERE status = 'signed'),
    'bookings_total', (SELECT count(*) FROM bookings),
    'clients_total', (SELECT count(*) FROM clients),
    'retainers_active', (SELECT count(*) FROM retainers WHERE status = 'active'),
    'emails_7d_sent', (SELECT count(*) FROM (
      SELECT DISTINCT ON (idempotency_key) status FROM email_send_log
      WHERE created_at > now() - interval '7 days' AND idempotency_key IS NOT NULL
      ORDER BY idempotency_key, created_at DESC
    ) e WHERE status = 'sent'),
    'emails_7d_failed', (SELECT count(*) FROM (
      SELECT DISTINCT ON (idempotency_key) status FROM email_send_log
      WHERE created_at > now() - interval '7 days' AND idempotency_key IS NOT NULL
      ORDER BY idempotency_key, created_at DESC
    ) e WHERE status IN ('failed','dlq'))
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_list(_search TEXT DEFAULT NULL, _limit INT DEFAULT 50, _offset INT DEFAULT 0)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_active TIMESTAMPTZ,
  clients_count BIGINT,
  proposals_count BIGINT,
  contracts_signed BIGINT,
  bookings_count BIGINT,
  retainers_active BIGINT,
  revenue_cents BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    GREATEST(
      COALESCE((SELECT max(updated_at) FROM proposals WHERE user_id = u.id), 'epoch'::timestamptz),
      COALESCE((SELECT max(updated_at) FROM clients WHERE user_id = u.id), 'epoch'::timestamptz),
      COALESCE((SELECT max(updated_at) FROM contracts WHERE user_id = u.id), 'epoch'::timestamptz)
    ) AS last_active,
    (SELECT count(*) FROM clients WHERE user_id = u.id),
    (SELECT count(*) FROM proposals WHERE user_id = u.id),
    (SELECT count(*) FROM contracts WHERE user_id = u.id AND status = 'signed'),
    (SELECT count(*) FROM bookings WHERE user_id = u.id),
    (SELECT count(*) FROM retainers WHERE user_id = u.id AND status = 'active'),
    COALESCE((SELECT SUM(amount_cents) FROM proposals WHERE user_id = u.id AND client_paid = true), 0)
    + COALESCE((SELECT SUM(amount_cents) FROM retainer_invoices WHERE user_id = u.id AND status = 'paid'), 0)
  FROM auth.users u
  WHERE _search IS NULL OR u.email ILIKE '%' || _search || '%'
  ORDER BY u.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_self_super_admin(_secret TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- One-time bootstrap: only works if no super_admin exists yet
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'super_admin already assigned';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'super_admin');
  RETURN true;
END;
$$;
