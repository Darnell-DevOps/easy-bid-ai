
-- 1) Audit log table
CREATE TABLE public.admin_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid,
  action_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_actions_log TO authenticated;
GRANT ALL ON public.admin_actions_log TO service_role;

ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can read via direct table access (RPC also gates)
CREATE POLICY "Super admins can view admin actions log"
  ON public.admin_actions_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- No INSERT / UPDATE / DELETE policies — service role bypasses RLS,
-- authenticated/anon clients cannot write.

CREATE INDEX admin_actions_log_created_at_idx ON public.admin_actions_log (created_at DESC);
CREATE INDEX admin_actions_log_target_user_id_idx ON public.admin_actions_log (target_user_id);

-- 2) Helper: is a given user a super admin?
CREATE OR REPLACE FUNCTION public.admin_is_super_admin_user(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _target_user_id AND role = 'super_admin'::public.app_role
  );
END; $$;

-- 3) Read recent admin activity, joined with emails
CREATE OR REPLACE FUNCTION public.admin_get_actions_log(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  admin_user_id uuid,
  admin_email text,
  target_user_id uuid,
  target_email text,
  action_type text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.admin_user_id,
    (SELECT au.email::text FROM auth.users au WHERE au.id = l.admin_user_id),
    l.target_user_id,
    (SELECT au.email::text FROM auth.users au WHERE au.id = l.target_user_id),
    l.action_type,
    l.details,
    l.created_at
  FROM public.admin_actions_log l
  ORDER BY l.created_at DESC
  LIMIT COALESCE(_limit, 100);
END; $$;

-- 4) Extend admin_user_list to include ban status and full name
DROP FUNCTION IF EXISTS public.admin_user_list(text, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_user_list(_search text DEFAULT NULL::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  banned_until timestamptz,
  created_at timestamptz,
  last_active timestamptz,
  clients_count bigint,
  proposals_count bigint,
  contracts_signed bigint,
  bookings_count bigint,
  retainers_active bigint,
  revenue_cents bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::text AS full_name,
    u.banned_until,
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
END; $$;
