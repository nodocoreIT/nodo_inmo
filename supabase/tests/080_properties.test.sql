-- Test: nodo_inmo.properties — first business table, Template A (staff-shared)
--
-- Structure tests: table exists, PK, NOT NULL constraints, check constraints,
-- FK org_id → organizations, leading org_id index, updated_at auto-touch.
--
-- RLS tests (non-vacuous): seed two orgs as superuser, switch role via
-- request.jwt.claims. All state is rolled back at the end.
begin;
select plan(25);

-- -----------------------------------------------------------------------
-- Seed: two orgs + four users (superuser, bypasses RLS)
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('c1000000-0000-0000-0000-000000000001', 'admin-c@test.local',  'x', now(), now()),
  ('c2000000-0000-0000-0000-000000000002', 'agent-c@test.local',  'x', now(), now()),
  ('d1000000-0000-0000-0000-000000000001', 'admin-d@test.local',  'x', now(), now()),
  ('d2000000-0000-0000-0000-000000000002', 'agent-d@test.local',  'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('c0000000-0000-0000-0000-000000000001', 'Org C', 'starter'),
  ('d0000000-0000-0000-0000-000000000001', 'Org D', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'admin'),
  ('c0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'agent'),
  ('d0000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'admin'),
  ('d0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'agent');

-- -----------------------------------------------------------------------
-- 1. Structure: table and primary key
-- -----------------------------------------------------------------------
select has_table(
  'nodo_inmo', 'properties',
  'nodo_inmo.properties table exists'
);

select has_column(
  'nodo_inmo', 'properties', 'id',
  'properties has column: id'
);

select col_is_pk(
  'nodo_inmo', 'properties', 'id',
  'properties.id is the primary key'
);

-- -----------------------------------------------------------------------
-- 2. NOT NULL constraints
-- -----------------------------------------------------------------------
select col_not_null(
  'nodo_inmo', 'properties', 'org_id',
  'properties.org_id is NOT NULL'
);

select col_not_null(
  'nodo_inmo', 'properties', 'address',
  'properties.address is NOT NULL'
);

select col_not_null(
  'nodo_inmo', 'properties', 'operation',
  'properties.operation is NOT NULL'
);

select col_not_null(
  'nodo_inmo', 'properties', 'property_type',
  'properties.property_type is NOT NULL'
);

select col_not_null(
  'nodo_inmo', 'properties', 'status',
  'properties.status is NOT NULL'
);

select col_not_null(
  'nodo_inmo', 'properties', 'currency',
  'properties.currency is NOT NULL'
);

-- -----------------------------------------------------------------------
-- 3. Check constraints reject bad values
-- -----------------------------------------------------------------------
select throws_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, address, operation, property_type, status, currency)
      values
        ('c0000000-0000-0000-0000-000000000001','Av. Test 1','BAD_OP','apartment','available','ARS')
  $q$,
  null, null,
  'check(operation): bad value rejected'
);

select throws_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, address, operation, property_type, status, currency)
      values
        ('c0000000-0000-0000-0000-000000000001','Av. Test 1','rent','BAD_TYPE','available','ARS')
  $q$,
  null, null,
  'check(property_type): bad value rejected'
);

select throws_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, address, operation, property_type, status, currency)
      values
        ('c0000000-0000-0000-0000-000000000001','Av. Test 1','rent','apartment','BAD_STATUS','ARS')
  $q$,
  null, null,
  'check(status): bad value rejected'
);

select throws_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, address, operation, property_type, status, currency)
      values
        ('c0000000-0000-0000-0000-000000000001','Av. Test 1','rent','apartment','available','EUR')
  $q$,
  null, null,
  'check(currency): bad value rejected'
);

-- -----------------------------------------------------------------------
-- 4. FK: org_id references shared.organizations
-- -----------------------------------------------------------------------
select throws_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, address, operation, property_type, status, currency)
      values
        ('ffffffff-ffff-ffff-ffff-ffffffffffff','Av. Test 1','rent','apartment','available','ARS')
  $q$,
  null, null,
  'FK org_id → shared.organizations: non-existent org_id is rejected'
);

-- -----------------------------------------------------------------------
-- 5. Leading index on org_id exists
-- -----------------------------------------------------------------------
select has_index(
  'nodo_inmo', 'properties',
  'properties_org_id_idx',
  'leading index on org_id exists'
);

-- -----------------------------------------------------------------------
-- 6. updated_at auto-touch: changes on UPDATE
-- -----------------------------------------------------------------------
-- Seed a row as superuser (bypasses RLS)
insert into nodo_inmo.properties
  (id, org_id, address, operation, property_type, status, currency)
values
  ('e0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Av. Corrientes 1234', 'rent', 'apartment', 'available', 'ARS');

-- Capture current updated_at
do $$
declare
  t1 timestamptz;
  t2 timestamptz;
begin
  select updated_at into t1
    from nodo_inmo.properties
   where id = 'e0000000-0000-0000-0000-000000000001';

  -- Short sleep so clock advances
  perform pg_sleep(0.02);

  update nodo_inmo.properties
     set address = 'Av. Corrientes 9999'
   where id = 'e0000000-0000-0000-0000-000000000001';

  select updated_at into t2
    from nodo_inmo.properties
   where id = 'e0000000-0000-0000-0000-000000000001';

  if t2 <= t1 then
    raise exception 'updated_at did not advance after UPDATE (t1=%, t2=%)', t1, t2;
  end if;
end $$;

select ok(true, 'updated_at advances on UPDATE');

-- -----------------------------------------------------------------------
-- 7. RLS — switch to authenticated role (non-vacuous: real rows in both orgs)
-- -----------------------------------------------------------------------

-- Seed properties for Org C and Org D as superuser
insert into nodo_inmo.properties
  (id, org_id, address, operation, property_type, status, currency)
values
  ('c0000000-0000-0000-0000-000000000010',
   'c0000000-0000-0000-0000-000000000001',
   'Palermo 100', 'rent', 'apartment', 'available', 'ARS'),
  ('c0000000-0000-0000-0000-000000000011',
   'c0000000-0000-0000-0000-000000000001',
   'Belgrano 200', 'sale', 'house', 'available', 'USD'),
  ('d0000000-0000-0000-0000-000000000010',
   'd0000000-0000-0000-0000-000000000001',
   'Rosario 300', 'rent', 'commercial', 'available', 'ARS');

-- -----------------------------------------------------------------------
-- 7a. Cross-tenant: Org C agent reads 0 Org D properties
-- -----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"c0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.properties
    where org_id = 'd0000000-0000-0000-0000-000000000001'),
  0,
  'RLS: Org C agent sees 0 Org D properties (cross-tenant blocked)'
);

-- Total visible to Org C agent = 3 (2 Org C properties seeded above + the updated_at fixture)
select is(
  (select count(*)::int from nodo_inmo.properties),
  3,
  'RLS: Org C agent sees only Org C properties (3 rows)'
);

-- -----------------------------------------------------------------------
-- 7b. Template A: AGENT of Org C can INSERT
-- -----------------------------------------------------------------------
select lives_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, address, operation, property_type, status, currency)
      values
        ('c0000000-0000-0000-0000-000000000001', 'Flores 50', 'rent', 'apartment', 'available', 'ARS')
  $q$,
  'TemplateA: agent can INSERT own org property'
);

-- -----------------------------------------------------------------------
-- 7c. Template A: ADMIN of Org C can INSERT
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"c0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, address, operation, property_type, status, currency)
      values
        ('c0000000-0000-0000-0000-000000000001', 'Caballito 99', 'sale', 'house', 'available', 'USD')
  $q$,
  'TemplateA: admin can INSERT own org property'
);

-- -----------------------------------------------------------------------
-- 7d. Template A: AGENT of Org C can SELECT
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"c0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.properties where address = 'Flores 50'),
  1,
  'TemplateA: agent can SELECT own org property'
);

-- -----------------------------------------------------------------------
-- 7e. Template A: AGENT of Org C can UPDATE
-- -----------------------------------------------------------------------
select lives_ok(
  $q$ update nodo_inmo.properties
         set description = 'Updated by agent'
       where address = 'Flores 50'
         and org_id = 'c0000000-0000-0000-0000-000000000001'
  $q$,
  'TemplateA: agent can UPDATE own org property'
);

-- -----------------------------------------------------------------------
-- 7f. Template A: AGENT of Org C can DELETE
-- -----------------------------------------------------------------------
select lives_ok(
  $q$ delete from nodo_inmo.properties
       where address = 'Flores 50'
         and org_id = 'c0000000-0000-0000-0000-000000000001'
  $q$,
  'TemplateA: agent can DELETE own org property'
);

-- -----------------------------------------------------------------------
-- 7g. UPDATE WITH CHECK: org_id cannot be reassigned to Org D
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"c0000000-0000-0000-0000-000000000001","role":"admin"}}';

select throws_ok(
  $q$ update nodo_inmo.properties
         set org_id = 'd0000000-0000-0000-0000-000000000001'
       where org_id = 'c0000000-0000-0000-0000-000000000001'
         and address = 'Palermo 100'
  $q$,
  null, null,
  'RLS: UPDATE cannot reassign org_id to another org (WITH CHECK)'
);

-- -----------------------------------------------------------------------
-- 7h. Template A contrasted with B: prove agent is NOT blocked
--     (Template B would return 0 for agent; Template A returns rows)
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"c0000000-0000-0000-0000-000000000001","role":"agent"}}';

-- Agent sees Org C properties (Template A, not admin-only)
select cmp_ok(
  (select count(*)::int from nodo_inmo.properties
    where org_id = 'c0000000-0000-0000-0000-000000000001'),
  '>',
  0,
  'TemplateA (vs B): agent sees org properties — NOT blocked (confirms staff-shared)'
);

select * from finish();
rollback;
