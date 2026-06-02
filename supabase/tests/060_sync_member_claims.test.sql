-- Test: R13 (removed) — verify old trigger/function machinery was dropped
--
-- The sync_member_claims trigger + function have been superseded by the
-- Custom Access Token Hook (R14, 070_access_token_hook.test.sql).
-- This file now asserts the OLD machinery is gone so a future accidental
-- re-introduction of the trigger is caught.
begin;
select plan(4);

-- 1. shared.sync_member_claims() function no longer exists
select hasnt_function(
  'shared',
  'sync_member_claims',
  'shared.sync_member_claims() trigger function was dropped (superseded by hook)'
);

-- 2. No functions named sync_member_claims anywhere
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'sync_member_claims'
  ),
  0,
  'No sync_member_claims function in any schema'
);

-- 3. Trigger sync_member_claims_aiu no longer exists on shared.org_members
select hasnt_trigger(
  'shared',
  'org_members',
  'sync_member_claims_aiu',
  'Trigger sync_member_claims_aiu was dropped (superseded by hook)'
);

-- 4. shared.custom_access_token_hook is the replacement — it exists
select has_function(
  'shared',
  'custom_access_token_hook',
  ARRAY['jsonb'],
  'shared.custom_access_token_hook(jsonb) is the replacement (hook)'
);

select * from finish();
rollback;
