-- R13: JWT app_metadata sync via trigger -> Edge Function
--
-- shared.sync_member_claims() is a SECURITY DEFINER trigger function that
-- calls the sync-member-claims Edge Function via pg_net after any INSERT or
-- UPDATE of (role, org_id) on shared.org_members.
--
-- Security notes:
--   - security definer: runs as the function owner (postgres) so it can call
--     net.http_post regardless of the caller's role.
--   - set search_path = '': all object references are fully qualified to
--     prevent search_path injection attacks.
--   - The Edge Function URL and trigger secret are read from Postgres config
--     settings (app.settings.*) set via supabase secrets / vault, never
--     hardcoded in this file.
--   - pg_net lives in schema 'net'; referenced as net.http_post (fully qualified).

-- Ensure pg_net extension is present (idempotent; already present on local)
create extension if not exists pg_net with schema net;

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------
create or replace function shared.sync_member_claims()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_edge_url  text;
  v_secret    text;
begin
  -- Read configuration from Postgres settings injected via supabase secrets.
  -- On local dev without the secrets set, skip silently so INSERT/UPDATE on
  -- org_members still works without a running Edge Function.
  v_edge_url := current_setting('app.settings.edge_function_url', true);
  v_secret   := current_setting('app.settings.sync_claims_secret', true);

  if v_edge_url is null or v_edge_url = '' then
    return new;
  end if;

  -- Fire-and-forget: pg_net queues the HTTP request asynchronously.
  -- Failures are visible in net._http_response and do not abort the
  -- triggering transaction (idempotent design: re-run the trigger on retry).
  perform net.http_post(
    url     := v_edge_url,
    body    := jsonb_build_object(
                 'user_id', new.user_id,
                 'org_id',  new.org_id,
                 'role',    new.role
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || coalesce(v_secret, '')
               )
  );

  return new;
end;
$$;

-- Revoke public execute on the security definer function.
-- The trigger (running as postgres/superuser) can still invoke it.
revoke execute on function shared.sync_member_claims() from public;

-- ---------------------------------------------------------------------------
-- Trigger on shared.org_members
-- AFTER INSERT OR UPDATE OF role, org_id — only fires on membership changes
-- ---------------------------------------------------------------------------
create trigger sync_member_claims_aiu
  after insert or update of role, org_id
  on shared.org_members
  for each row
  execute function shared.sync_member_claims();
