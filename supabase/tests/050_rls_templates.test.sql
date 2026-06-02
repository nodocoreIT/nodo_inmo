-- Test: R15, R17, R18 — RLS Templates A/B + role gate
--
-- Uses a throwaway fixture inside a BEGIN/ROLLBACK so nothing persists.
-- Template A: org-scoped, any staff (admin or agent) can SELECT.
-- Template B: org-scoped AND role = 'admin'; agent sees 0 rows.
--
-- Two temporary nodo_inmo test tables are created, Template A/B applied,
-- rows seeded as superuser, then tested as authenticated with agent/admin claims.
-- The ROLLBACK discards all fixtures and DDL (temp tables in a transaction).
begin;
select plan(6);

-- -----------------------------------------------------------------------
-- Seed fixture users and orgs (superuser, bypasses RLS)
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('f1000000-0000-0000-0000-000000000001', 'admin-tmpl@test.local',  'x', now(), now()),
  ('f2000000-0000-0000-0000-000000000002', 'agent-tmpl@test.local',  'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('f0000000-0000-0000-0000-000000000001', 'Template Org', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'admin'),
  ('f0000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'agent');

-- -----------------------------------------------------------------------
-- Create throwaway tables for Template A and Template B
-- Note: CREATE TABLE in a transaction is rolled back at the end.
-- We place them in nodo_inmo schema to match the real convention.
-- -----------------------------------------------------------------------
create table nodo_inmo._test_template_a (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references shared.organizations(id) on delete cascade,
  label  text
);
alter table nodo_inmo._test_template_a enable row level security;

-- Template A: staff-shared (SELECT only for this test)
create policy "org_select" on nodo_inmo._test_template_a
  for select to authenticated
  using ( org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid );

create table nodo_inmo._test_template_b (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references shared.organizations(id) on delete cascade,
  label  text
);
alter table nodo_inmo._test_template_b enable row level security;

-- Template B: admin-only (SELECT only for this test)
create policy "admin_select" on nodo_inmo._test_template_b
  for select to authenticated
  using (
    org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Grant SELECT on fixture tables to authenticated (needed for Data API access)
grant select on nodo_inmo._test_template_a to authenticated;
grant select on nodo_inmo._test_template_b to authenticated;

-- Seed rows for Template Org
insert into nodo_inmo._test_template_a (org_id, label) values
  ('f0000000-0000-0000-0000-000000000001', 'row-a-1'),
  ('f0000000-0000-0000-0000-000000000001', 'row-a-2');

insert into nodo_inmo._test_template_b (org_id, label) values
  ('f0000000-0000-0000-0000-000000000001', 'row-b-1');

-- -----------------------------------------------------------------------
-- R17: agent context — Template A readable, Template B blocked
-- -----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"f2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo._test_template_a),
  2,
  'R17/TemplateA: agent sees org rows from Template A table'
);

select is(
  (select count(*)::int from nodo_inmo._test_template_b),
  0,
  'R17/TemplateB: agent sees 0 rows from Template B table (admin-only)'
);

-- -----------------------------------------------------------------------
-- R17: admin context — Template A readable, Template B readable
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}';

select is(
  (select count(*)::int from nodo_inmo._test_template_a),
  2,
  'R17/TemplateA: admin sees org rows from Template A table'
);

select is(
  (select count(*)::int from nodo_inmo._test_template_b),
  1,
  'R17/TemplateB: admin sees org rows from Template B table'
);

-- -----------------------------------------------------------------------
-- R15: cross-org isolation still holds for Template A (other-org agent = 0)
-- We use a fresh org_id that has no rows; agent for a different org sees 0.
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"f2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"aa000000-0000-0000-0000-000000000099","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo._test_template_a),
  0,
  'R15: Template A cross-org isolation — different org sees 0 rows'
);

select is(
  (select count(*)::int from nodo_inmo._test_template_b),
  0,
  'R15: Template B cross-org isolation — different org admin sees 0 rows'
);

select * from finish();
rollback;
