
create or replace function public.list_my_oauth_consents()
returns table (
  consent_id uuid,
  client_id uuid,
  client_name text,
  client_uri text,
  logo_uri text,
  scopes text,
  granted_at timestamptz,
  active_sessions bigint
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    c.id,
    c.client_id,
    coalesce(oc.client_name, 'Unknown app'),
    oc.client_uri,
    oc.logo_uri,
    c.scopes,
    c.granted_at,
    (select count(*) from auth.sessions s
       where s.user_id = c.user_id and s.oauth_client_id = c.client_id)
  from auth.oauth_consents c
  left join auth.oauth_clients oc on oc.id = c.client_id
  where c.user_id = auth.uid()
    and c.revoked_at is null
  order by c.granted_at desc
$$;

create or replace function public.revoke_my_oauth_consent(p_consent_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_client uuid;
  v_sessions int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select client_id into v_client
  from auth.oauth_consents
  where id = p_consent_id and user_id = auth.uid();

  if v_client is null then
    return jsonb_build_object('revoked', false, 'reason', 'not_found');
  end if;

  update auth.oauth_consents
     set revoked_at = now()
   where id = p_consent_id and user_id = auth.uid() and revoked_at is null;

  with removed as (
    delete from auth.sessions
     where user_id = auth.uid() and oauth_client_id = v_client
     returning 1
  )
  select count(*) into v_sessions from removed;

  return jsonb_build_object('revoked', true, 'sessions_ended', v_sessions);
end;
$$;

revoke execute on function public.list_my_oauth_consents() from public, anon;
revoke execute on function public.revoke_my_oauth_consent(uuid) from public, anon;
grant execute on function public.list_my_oauth_consents() to authenticated, service_role;
grant execute on function public.revoke_my_oauth_consent(uuid) to authenticated, service_role;
