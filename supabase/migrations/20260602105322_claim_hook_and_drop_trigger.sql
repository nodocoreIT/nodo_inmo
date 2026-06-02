-- R14: Custom Access Token Hook — replaces trigger→Edge Function claim sync
--
-- This migration:
--   a) Drops the old sync_member_claims trigger and function (pg_net kept).
--   b) Creates shared.custom_access_token_hook(jsonb) — called by GoTrue at
--      token-mint time to inject org_id + role into app_metadata.
--   c) Grants the minimum permissions required by the Supabase hook contract.
--
-- RLS policies are UNCHANGED; they already read:
--   auth.jwt() -> 'app_metadata' ->> 'org_id' / 'role'

-- ---------------------------------------------------------------------------
-- a) Drop old trigger machinery (pg_net extension stays)
-- ---------------------------------------------------------------------------
drop trigger if exists sync_member_claims_aiu on shared.org_members;
drop function if exists shared.sync_member_claims();

-- ---------------------------------------------------------------------------
-- b) Custom Access Token Hook
-- ---------------------------------------------------------------------------
create or replace function shared.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_org_id uuid;
  v_role   text;
begin
  select org_id, role into v_org_id, v_role
  from shared.org_members
  where user_id = (event->>'user_id')::uuid
  limit 1;

  v_claims := event->'claims';

  if v_org_id is not null then
    v_claims := jsonb_set(
      v_claims,
      '{app_metadata}',
      coalesce(v_claims->'app_metadata', '{}'::jsonb)
        || jsonb_build_object('org_id', v_org_id, 'role', v_role)
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- ---------------------------------------------------------------------------
-- c) Grants — Supabase hook permission model
--    https://supabase.com/docs/guides/auth/auth-hooks#hook-grants-and-permissions
-- ---------------------------------------------------------------------------

-- GoTrue runs as supabase_auth_admin; it needs usage on the schema and
-- execute on the hook function.
grant usage on schema shared to supabase_auth_admin;
grant execute on function shared.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Revoke execute from the broad default-public grant and from standard roles.
-- The function is security definer (runs as postgres) so execute privilege
-- must be tightly controlled.
revoke execute on function shared.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- supabase_auth_admin needs SELECT on shared.org_members for the lookup inside
-- the security definer body.  The function already runs as postgres (owner),
-- so this is belt-and-suspenders for environments where the ownership differs.
grant select on shared.org_members to supabase_auth_admin;