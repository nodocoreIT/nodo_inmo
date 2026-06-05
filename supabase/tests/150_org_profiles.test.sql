-- Test: nodo_inmo.org_profiles + org-branding Storage bucket
--
-- ADMIN-ONLY (Template B): org-scoped AND role = 'admin'. Agents are blocked.
-- Storage bucket: org-branding (private, org-scoped policies, raster-only MIME).
--
-- TDD: RED first (table/bucket do not exist), GREEN after migration (A-WU2).
-- Style mirrors 140_property_expenses.test.sql.
begin;
select plan(36);

-- -----------------------------------------------------------------------
-- Seed: two orgs, admin + agent for org G, admin for org H (cross-tenant)
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('a1500000-0000-0000-0000-000000000001', 'admin-g@test.local', 'x', now(), now()),
  ('a1500000-0000-0000-0000-000000000002', 'agent-g@test.local', 'x', now(), now()),
  ('b1500000-0000-0000-0000-000000000001', 'admin-h@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('c1500000-0000-0000-0000-000000000001', 'Org G', 'starter'),
  ('d1500000-0000-0000-0000-000000000002', 'Org H', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('c1500000-0000-0000-0000-000000000001', 'a1500000-0000-0000-0000-000000000001', 'admin'),
  ('c1500000-0000-0000-0000-000000000001', 'a1500000-0000-0000-0000-000000000002', 'agent'),
  ('d1500000-0000-0000-0000-000000000002', 'b1500000-0000-0000-0000-000000000001', 'admin');

-- -----------------------------------------------------------------------
-- A. Table existence and shape (R-A1, R-A2)
-- -----------------------------------------------------------------------

-- R-A1: table exists
select has_table('nodo_inmo', 'org_profiles', 'org_profiles table exists');

-- R-A2: org_id is the PK (not a separate 'id' column — ADR-1)
select col_is_pk('nodo_inmo', 'org_profiles', 'org_id', 'org_profiles.org_id is the PK');

-- R-A2: column types
select col_type_is('nodo_inmo', 'org_profiles', 'org_id',     'uuid',                     'org_profiles.org_id is uuid');
select col_type_is('nodo_inmo', 'org_profiles', 'legal_name', 'text',                     'org_profiles.legal_name is text');
select col_type_is('nodo_inmo', 'org_profiles', 'address',    'text',                     'org_profiles.address is text');
select col_type_is('nodo_inmo', 'org_profiles', 'cuit',       'text',                     'org_profiles.cuit is text');
select col_type_is('nodo_inmo', 'org_profiles', 'phone',      'text',                     'org_profiles.phone is text');
select col_type_is('nodo_inmo', 'org_profiles', 'email',      'text',                     'org_profiles.email is text');
select col_type_is('nodo_inmo', 'org_profiles', 'logo_path',  'text',                     'org_profiles.logo_path is text');
select col_type_is('nodo_inmo', 'org_profiles', 'created_at', 'timestamp with time zone', 'org_profiles.created_at is timestamptz');
select col_type_is('nodo_inmo', 'org_profiles', 'updated_at', 'timestamp with time zone', 'org_profiles.updated_at is timestamptz');

-- R-A2: NOT NULL enforcement
select col_not_null('nodo_inmo', 'org_profiles', 'org_id',     'org_profiles.org_id NOT NULL');
select col_not_null('nodo_inmo', 'org_profiles', 'created_at', 'org_profiles.created_at NOT NULL');
select col_not_null('nodo_inmo', 'org_profiles', 'updated_at', 'org_profiles.updated_at NOT NULL');

-- R-A2: nullable columns
select col_is_null('nodo_inmo', 'org_profiles', 'legal_name', 'org_profiles.legal_name is nullable');
select col_is_null('nodo_inmo', 'org_profiles', 'address',    'org_profiles.address is nullable');
select col_is_null('nodo_inmo', 'org_profiles', 'cuit',       'org_profiles.cuit is nullable');
select col_is_null('nodo_inmo', 'org_profiles', 'phone',      'org_profiles.phone is nullable');
select col_is_null('nodo_inmo', 'org_profiles', 'email',      'org_profiles.email is nullable');
select col_is_null('nodo_inmo', 'org_profiles', 'logo_path',  'org_profiles.logo_path is nullable');

-- R-A3: unique constraint / PK violation on duplicate org_id
-- Insert a valid row first (as superuser, bypasses RLS)
select lives_ok(
  $q$ insert into nodo_inmo.org_profiles (org_id, legal_name)
      values ('c1500000-0000-0000-0000-000000000001', 'Inmobiliaria G') $q$,
  'R-A3: first insert for org G succeeds');

select throws_ok(
  $q$ insert into nodo_inmo.org_profiles (org_id, legal_name)
      values ('c1500000-0000-0000-0000-000000000001', 'Inmobiliaria G Dup') $q$,
  null, null, 'R-A3: second INSERT with same org_id rejected (PK/unique violation)');

-- R-A4: updated_at advances on UPDATE (trigger fires)
do $$
declare t1 timestamptz; t2 timestamptz;
begin
  select updated_at into t1 from nodo_inmo.org_profiles where org_id = 'c1500000-0000-0000-0000-000000000001';
  perform pg_sleep(0.02);
  update nodo_inmo.org_profiles set address = 'Corrientes 1234' where org_id = 'c1500000-0000-0000-0000-000000000001';
  select updated_at into t2 from nodo_inmo.org_profiles where org_id = 'c1500000-0000-0000-0000-000000000001';
  if t2 <= t1 then raise exception 'updated_at did not advance'; end if;
end $$;
select ok(true, 'R-A4: org_profiles.updated_at advances on UPDATE (trigger fires)');

-- -----------------------------------------------------------------------
-- B. RLS — Template B (admin-only) (R-A6 through R-A12)
-- -----------------------------------------------------------------------

-- R-A6: RLS enabled
select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'nodo_inmo' and c.relname = 'org_profiles'),
  true, 'R-A6: org_profiles RLS is enabled');

-- Seed an Org H profile as superuser (bypasses RLS) for cross-tenant assertions
insert into nodo_inmo.org_profiles (org_id, legal_name)
values ('d1500000-0000-0000-0000-000000000002', 'Inmobiliaria H');

set local role authenticated;

-- R-A9: agent JWT → SELECT returns 0 rows
set local request.jwt.claims = '{"sub":"a1500000-0000-0000-0000-000000000002","app_metadata":{"org_id":"c1500000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.org_profiles where org_id = 'c1500000-0000-0000-0000-000000000001'),
  0, 'R-A9: agent sees 0 org_profiles rows (admin-only)');

-- R-A9: agent INSERT is rejected
select throws_ok(
  $q$ insert into nodo_inmo.org_profiles (org_id, legal_name)
      values ('c1500000-0000-0000-0000-000000000001', 'Agent attempt') $q$,
  null, null, 'R-A9: agent INSERT into org_profiles blocked');

-- R-A7 / R-A8: admin JWT → SELECT + UPDATE
set local request.jwt.claims = '{"sub":"a1500000-0000-0000-0000-000000000001","app_metadata":{"org_id":"c1500000-0000-0000-0000-000000000001","role":"admin"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.org_profiles where org_id = 'c1500000-0000-0000-0000-000000000001'),
  '>', 0, 'R-A7: admin sees own org_profile');

select lives_ok(
  $q$ update nodo_inmo.org_profiles set address = 'Rivadavia 500'
      where org_id = 'c1500000-0000-0000-0000-000000000001' $q$,
  'R-A8: admin can UPDATE own org_profile');

-- R-A10: cross-org — admin G cannot see org H profile
select is(
  (select count(*)::int from nodo_inmo.org_profiles where org_id = 'd1500000-0000-0000-0000-000000000002'),
  0, 'R-A10: admin G cannot see org H profile (cross-org blocked)');

-- R-A11: UPDATE cannot reassign org_id to a valid other org (WITH CHECK)
-- Uses a valid org UUID (Org H) to ensure only the RLS WITH CHECK blocks it.
select throws_ok(
  $q$ update nodo_inmo.org_profiles
        set org_id = 'd1500000-0000-0000-0000-000000000002'
      where org_id = 'c1500000-0000-0000-0000-000000000001' $q$,
  null, null, 'R-A11: UPDATE cannot reassign org_id to valid other org (WITH CHECK)');

-- R-A12: anon role → SELECT blocked
set local role anon;

select throws_ok(
  $q$ select count(*) from nodo_inmo.org_profiles $q$,
  null, null, 'R-A12: anon SELECT on org_profiles is blocked');

set local role postgres;

-- -----------------------------------------------------------------------
-- C. Storage — private bucket org-branding (R-A13) + policy existence
-- -----------------------------------------------------------------------

-- R-A13: bucket exists and is private
select is(
  (select public from storage.buckets where id = 'org-branding'),
  false, 'R-A13: org-branding bucket is private (public = false)');

-- Storage policies — assert each branding_admin_* policy individually.
-- Using ok(exists(...)) mirrors 140_property_expenses.test.sql to avoid
-- false failures when unrelated future policies are added.
select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'branding_admin_select'),
  'storage policy branding_admin_select exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'branding_admin_insert'),
  'storage policy branding_admin_insert exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'branding_admin_update'),
  'storage policy branding_admin_update exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'branding_admin_delete'),
  'storage policy branding_admin_delete exists');

select * from finish();
rollback;
