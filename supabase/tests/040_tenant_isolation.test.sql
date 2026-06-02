-- Test: R7–R12 — Tenant isolation RLS policies
--
-- Pattern: seed data as postgres (superuser, bypasses RLS), then switch to
-- `authenticated` role with JWT claims injected via set local.
--
-- All state is rolled back at the end — transactional pgTAP.
begin;
select plan(13);

-- -----------------------------------------------------------------------
-- Seed: two orgs, four users (as superuser — bypasses RLS)
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'user-a@test.local',       'x', now(), now()),
  ('b0000000-0000-0000-0000-000000000001', 'user-b@test.local',       'x', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'admin-a@test.local',      'x', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'agent-a@test.local',      'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('aa000000-0000-0000-0000-000000000001', 'Org A', 'starter'),
  ('bb000000-0000-0000-0000-000000000001', 'Org B', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'agent'),
  ('bb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'agent'),
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin'),
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'agent');

insert into shared.nodo_id (org_id, product) values
  ('aa000000-0000-0000-0000-000000000001', 'inmo'),
  ('bb000000-0000-0000-0000-000000000001', 'inmo');

insert into shared.user_profiles (id, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'Alice Org A'),
  ('b0000000-0000-0000-0000-000000000001', 'Bob Org B');

insert into shared.indices (kind, period, value) values
  ('IPC', '2024-01-01', 1.00),
  ('ICL', '2024-01-01', 2.00);

-- -----------------------------------------------------------------------
-- R7: cross-tenant read blocked — user-a (org A) sees 0 rows from org B
-- -----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"aa000000-0000-0000-0000-000000000001","role":"agent"}}';

-- user-a sees their own org in organizations
select is(
  (select count(*)::int from shared.organizations),
  1,
  'R7: user-a sees exactly 1 org (own org A)'
);

-- user-a sees 0 rows from org B in organizations (cross-tenant blocked)
select is(
  (select count(*)::int from shared.organizations
   where id = 'bb000000-0000-0000-0000-000000000001'),
  0,
  'R7: user-a cannot see org B (cross-tenant blocked)'
);

-- user-a sees only their org_members
select is(
  (select count(*)::int from shared.org_members
   where org_id = 'bb000000-0000-0000-0000-000000000001'),
  0,
  'R7: user-a cannot see org B members'
);

-- nodo_id: user-a sees only org A
select is(
  (select count(*)::int from shared.nodo_id),
  1,
  'R7: user-a sees only own org nodo_id entry'
);

-- -----------------------------------------------------------------------
-- R8: user_metadata cannot escalate — even if user_metadata had a different
--     org_id, the effective access is gated by app_metadata.
-- JWT has app_metadata.org_id = A but we pass a conflicting claim to test
-- that the policy ONLY uses app_metadata (tested implicitly: policy SQL
-- reads jwt() -> 'app_metadata', never 'user_metadata').
-- We verify by setting user_metadata org_id to B — access must stay in A.
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","user_metadata":{"org_id":"bb000000-0000-0000-0000-000000000001"},"app_metadata":{"org_id":"aa000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from shared.organizations),
  1,
  'R8: user_metadata org_id does not override app_metadata — still sees only 1 org'
);

-- -----------------------------------------------------------------------
-- R9: UPDATE cannot reassign org_id (WITH CHECK)
-- -----------------------------------------------------------------------
-- user-a has agent role; try to change their nodo_id entry's org_id to B
select throws_ok(
  $q$ update shared.nodo_id
      set org_id = 'bb000000-0000-0000-0000-000000000001'
      where org_id = 'aa000000-0000-0000-0000-000000000001' $q$,
  null,
  null,
  'R9: UPDATE cannot reassign org_id to another org'
);

-- -----------------------------------------------------------------------
-- R10: membership write — agent cannot insert into org_members
-- -----------------------------------------------------------------------
-- user-a is agent in org A
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","app_metadata":{"org_id":"aa000000-0000-0000-0000-000000000001","role":"agent"}}';

select throws_ok(
  $q$ insert into shared.org_members (org_id, user_id, role)
      values ('aa000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','agent') $q$,
  null,
  null,
  'R10: agent cannot insert into org_members'
);

-- admin-a can insert into org_members
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"aa000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ insert into shared.org_members (org_id, user_id, role)
      values ('aa000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','tenant') $q$,
  'R10: admin can insert into org_members'
);

-- S1: even an admin cannot reassign a member to another org (WITH CHECK).
-- The row is visible (USING: org A), but the new org_id = B fails WITH CHECK.
select throws_ok(
  $q$ update shared.org_members
      set org_id = 'bb000000-0000-0000-0000-000000000001'
      where user_id = 'b0000000-0000-0000-0000-000000000001'
        and org_id = 'aa000000-0000-0000-0000-000000000001' $q$,
  null,
  null,
  'R10/S1: admin cannot reassign a member to another org (WITH CHECK)'
);

-- S2: an admin can delete a member of their own org.
select lives_ok(
  $q$ delete from shared.org_members
      where user_id = 'b0000000-0000-0000-0000-000000000001'
        and org_id = 'aa000000-0000-0000-0000-000000000001' $q$,
  'R10/S2: admin can delete a member of own org'
);

-- -----------------------------------------------------------------------
-- R11: user_profiles — self-scoped
-- user-a can read their own profile, cannot read user-b's
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"aa000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from shared.user_profiles),
  1,
  'R11: user sees only own user_profiles row'
);

-- -----------------------------------------------------------------------
-- R12: indices — all authenticated can read, none can write
-- -----------------------------------------------------------------------
select is(
  (select count(*)::int from shared.indices),
  2,
  'R12: authenticated user can read all indices rows'
);

select throws_ok(
  $q$ insert into shared.indices (kind, period, value)
      values ('IPC', '2025-01-01', 9.99) $q$,
  null,
  null,
  'R12: authenticated cannot insert into shared.indices'
);

select * from finish();
rollback;
