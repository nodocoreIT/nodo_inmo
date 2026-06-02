-- Test: R14 — shared.custom_access_token_hook()
--
-- Verifies:
--   1. Function exists.
--   2. Function is stable + security definer.
--   3. search_path is '' (empty) on the function.
--   4. supabase_auth_admin has EXECUTE privilege.
--   5. Hook injects org_id + role into app_metadata for a member user.
--   6. Hook returns event unchanged (no org_id/role injected) for non-member.
begin;
select plan(6);

-- -----------------------------------------------------------------------
-- Seed: org + user + membership as superuser (bypasses RLS)
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values (
    'cc000000-0000-0000-0000-000000000001',
    'hook-test@test.local',
    'x',
    now(),
    now()
  );

insert into shared.organizations (id, name, tier)
  values ('cc000000-0000-0000-0000-000000000099', 'Hook Test Org', 'starter');

insert into shared.org_members (org_id, user_id, role)
  values (
    'cc000000-0000-0000-0000-000000000099',
    'cc000000-0000-0000-0000-000000000001',
    'admin'
  );

-- -----------------------------------------------------------------------
-- 1. Function exists
-- -----------------------------------------------------------------------
select has_function(
  'shared',
  'custom_access_token_hook',
  ARRAY['jsonb'],
  'shared.custom_access_token_hook(jsonb) exists'
);

-- -----------------------------------------------------------------------
-- 2. Function is security definer
-- -----------------------------------------------------------------------
select is(
  (
    select prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shared'
      and p.proname = 'custom_access_token_hook'
  ),
  true,
  'shared.custom_access_token_hook() is security definer'
);

-- -----------------------------------------------------------------------
-- 3. search_path is '' (empty string) on the function.
-- Postgres stores it as 'search_path=""' in proconfig.
-- -----------------------------------------------------------------------
select is(
  (
    select cfg
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace,
    lateral pg_catalog.unnest(p.proconfig) as cfg
    where n.nspname = 'shared'
      and p.proname = 'custom_access_token_hook'
      and cfg like 'search_path=%'
    limit 1
  ),
  'search_path=""',
  'shared.custom_access_token_hook() has search_path set to empty string'
);

-- -----------------------------------------------------------------------
-- 4. supabase_auth_admin has EXECUTE on the hook
-- -----------------------------------------------------------------------
select is(
  (
    select has_function_privilege(
      'supabase_auth_admin',
      'shared.custom_access_token_hook(jsonb)',
      'EXECUTE'
    )
  ),
  true,
  'supabase_auth_admin has EXECUTE on shared.custom_access_token_hook'
);

-- -----------------------------------------------------------------------
-- 5. Hook injects org_id + role for a known member
-- -----------------------------------------------------------------------
do $$
declare
  v_event  jsonb;
  v_result jsonb;
  v_app    jsonb;
begin
  v_event := jsonb_build_object(
    'user_id', 'cc000000-0000-0000-0000-000000000001',
    'claims',  jsonb_build_object('app_metadata', '{}'::jsonb)
  );
  v_result := shared.custom_access_token_hook(v_event);
  v_app    := v_result->'claims'->'app_metadata';

  assert v_app->>'org_id' = 'cc000000-0000-0000-0000-000000000099',
    'Hook must inject org_id = cc000000-0000-0000-0000-000000000099, got: ' || coalesce(v_app->>'org_id', 'NULL');

  assert v_app->>'role' = 'admin',
    'Hook must inject role = admin, got: ' || coalesce(v_app->>'role', 'NULL');
end;
$$;

select ok(true, 'R14: hook injects org_id and role for member user');

-- -----------------------------------------------------------------------
-- 6. Hook leaves app_metadata without org_id/role for non-member
-- -----------------------------------------------------------------------
do $$
declare
  v_event  jsonb;
  v_result jsonb;
  v_app    jsonb;
begin
  v_event := jsonb_build_object(
    'user_id', 'dd000000-0000-0000-0000-000000000099',   -- no membership row
    'claims',  jsonb_build_object('app_metadata', '{}'::jsonb)
  );
  v_result := shared.custom_access_token_hook(v_event);
  v_app    := v_result->'claims'->'app_metadata';

  assert (v_app->>'org_id') is null,
    'Hook must NOT inject org_id for non-member, got: ' || coalesce(v_app->>'org_id', 'NULL');

  assert (v_app->>'role') is null,
    'Hook must NOT inject role for non-member, got: ' || coalesce(v_app->>'role', 'NULL');
end;
$$;

select ok(true, 'R14: hook leaves app_metadata clean for non-member user');

select * from finish();
rollback;
