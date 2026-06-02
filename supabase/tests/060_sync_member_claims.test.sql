-- Test: R13 — shared.sync_member_claims() structural assertions
--
-- Behavioral claim propagation requires a live auth service + served Edge Function
-- and is tested manually (see CONVENTIONS.md integration test section).
-- This file covers the structural contract only:
--   1. The trigger function exists and is security definer.
--   2. search_path is '' (empty) on the function.
--   3. The trigger exists on shared.org_members for AFTER INSERT OR UPDATE OF role, org_id.
begin;
select plan(4);

-- 1. Function shared.sync_member_claims exists
select has_function(
  'shared',
  'sync_member_claims',
  'shared.sync_member_claims() function exists'
);

-- 2. Function is security definer
select is(
  (
    select prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shared'
      and p.proname = 'sync_member_claims'
  ),
  true,
  'shared.sync_member_claims() is security definer'
);

-- 3. search_path is '' (empty string) on the function.
-- Postgres stores the GUC as 'search_path=""' for an empty search_path.
-- Use a lateral unnest to avoid set-returning function in WHERE clause.
select is(
  (
    select cfg
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace,
    lateral pg_catalog.unnest(p.proconfig) as cfg
    where n.nspname = 'shared'
      and p.proname = 'sync_member_claims'
      and cfg like 'search_path=%'
    limit 1
  ),
  'search_path=""',
  'shared.sync_member_claims() has search_path set to empty string'
);

-- 4. Trigger sync_member_claims_aiu exists on shared.org_members
select has_trigger(
  'shared',
  'org_members',
  'sync_member_claims_aiu',
  'Trigger sync_member_claims_aiu exists on shared.org_members'
);

select * from finish();
rollback;
