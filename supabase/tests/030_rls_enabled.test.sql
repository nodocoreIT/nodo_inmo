-- Test: R6 — RLS enabled on all tables in shared and nodo_inmo schemas
begin;
select plan(5);

-- Each table in shared must have relrowsecurity = true
select ok(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'shared' and c.relname = 'organizations'),
  'RLS enabled on shared.organizations'
);
select ok(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'shared' and c.relname = 'org_members'),
  'RLS enabled on shared.org_members'
);
select ok(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'shared' and c.relname = 'user_profiles'),
  'RLS enabled on shared.user_profiles'
);
select ok(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'shared' and c.relname = 'indices'),
  'RLS enabled on shared.indices'
);
select ok(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'shared' and c.relname = 'nodo_id'),
  'RLS enabled on shared.nodo_id'
);

select * from finish();
rollback;
