
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
      COALESCE((SELECT max(p.updated_at) FROM proposals p WHERE p.user_id = u.id), 'epoch'::timestamptz),
      COALESCE((SELECT max(c.updated_at) FROM clients c WHERE c.user_id = u.id), 'epoch'::timestamptz),
      COALESCE((SELECT max(ct.updated_at) FROM contracts ct WHERE ct.user_id = u.id), 'epoch'::timestamptz)
    ) AS last_active,
    (SELECT count(*) FROM clients c WHERE c.user_id = u.id),
    (SELECT count(*) FROM proposals p WHERE p.user_id = u.id),
    (SELECT count(*) FROM contracts ct WHERE ct.user_id = u.id AND ct.status = 'signed'),
    (SELECT count(*) FROM bookings b WHERE b.user_id = u.id),
    (SELECT count(*) FROM retainers r WHERE r.user_id = u.id AND r.status = 'active'),
    COALESCE((SELECT SUM(p.amount_cents) FROM proposals p WHERE p.user_id = u.id AND p.client_paid = true), 0)
    + COALESCE((SELECT SUM(ri.amount_cents) FROM retainer_invoices ri WHERE ri.user_id = u.id AND ri.status = 'paid'), 0)
  FROM auth.users u
  WHERE _search IS NULL OR u.email ILIKE '%' || _search || '%'
  ORDER BY u.created_at DESC
  LIMIT _limit OFFSET _offset;
END; $$;
