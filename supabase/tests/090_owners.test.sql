-- Test: nodo_inmo.owners — Template A (staff-shared), deferred FK wire
--
-- Structure tests: table exists, PK, NOT NULL constraints, defaults,
-- FK org_id → organizations, FK portal_user_id → auth.users,
-- FK owner_id → owners from properties (deferred wire), org_id index,
-- updated_at auto-touch.
--
-- RLS tests (non-vacuous): seed two orgs as superuser, switch role via
-- request.jwt.claims. All state is rolled back at the end.
begin;
select plan(26);

-- -----------------------------------------------------------------------
-- Seed: two orgs + four users (superuser, bypasses RLS)
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('e1000000-0000-0000-0000-000000000001', 'admin-e@test.local',  'x', now(), now()),
  ('e2000000-0000-0000-0000-000000000002', 'agent-e@test.local',  'x', now(), now()),
  ('f1000000-0000-0000-0000-000000000001', 'admin-f@test.local',  'x', now(), now()),
  ('f2000000-0000-0000-0000-000000000002', 'agent-f@test.local',  'x', now(), now()),
  ('a0000000-0000-0000-0000-000000000099', 'portal-user@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('e0000000-0000-0000-0000-000000000001', 'Org E', 'starter'),
  ('f0000000-0000-0000-0000-000000000001', 'Org F', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'admin'),
  ('e0000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'agent'),
  ('f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'admin'),
  ('f0000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'agent');

-- -----------------------------------------------------------------------
-- 1. Table exists
-- -----------------------------------------------------------------------
select has_table(
  'nodo_inmo', 'owners',
  'nodo_inmo.owners table exists'
);

-- -----------------------------------------------------------------------
-- 2. Primary key
-- -----------------------------------------------------------------------
select col_is_pk(
  'nodo_inmo', 'owners', 'id',
  'owners.id is the primary key'
);

-- -----------------------------------------------------------------------
-- 3. NOT NULL constraints
-- -----------------------------------------------------------------------
select col_not_null(
  'nodo_inmo', 'owners', 'org_id',
  'owners.org_id is NOT NULL'
);

select col_not_null(
  'nodo_inmo', 'owners', 'name',
  'owners.name is NOT NULL'
);

-- -----------------------------------------------------------------------
-- 4. Column defaults
-- -----------------------------------------------------------------------
select col_default_is(
  'nodo_inmo', 'owners', 'commission_rate', '10.00',
  'owners.commission_rate defaults to 10.00'
);

select col_default_is(
  'nodo_inmo', 'owners', 'can_view_rentals', 'false',
  'owners.can_view_rentals defaults to false'
);

select col_default_is(
  'nodo_inmo', 'owners', 'can_view_construction', 'false',
  'owners.can_view_construction defaults to false'
);

select col_default_is(
  'nodo_inmo', 'owners', 'can_view_sales', 'false',
  'owners.can_view_sales defaults to false'
);

-- -----------------------------------------------------------------------
-- 5. FK: org_id → shared.organizations
-- -----------------------------------------------------------------------
select throws_ok(
  $q$ insert into nodo_inmo.owners (org_id, name)
      values ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Ghost Owner')
  $q$,
  null, null,
  'FK org_id → shared.organizations: non-existent org_id rejected'
);

-- -----------------------------------------------------------------------
-- 6. FK: portal_user_id → auth.users (nullable, accepted + on delete set null)
-- -----------------------------------------------------------------------
-- Valid: insert with a known auth.users id
insert into nodo_inmo.owners (id, org_id, name, portal_user_id)
values (
  'e0000000-0000-0000-0000-000000000010',
  'e0000000-0000-0000-0000-000000000001',
  'Owner With Portal',
  'a0000000-0000-0000-0000-000000000099'
);

select ok(
  exists(
    select 1 from nodo_inmo.owners
     where id = 'e0000000-0000-0000-0000-000000000010'
       and portal_user_id = 'a0000000-0000-0000-0000-000000000099'
  ),
  'owners.portal_user_id: nullable FK to auth.users accepted'
);

-- Valid: insert with NULL portal_user_id
insert into nodo_inmo.owners (id, org_id, name, portal_user_id)
values (
  'e0000000-0000-0000-0000-000000000011',
  'e0000000-0000-0000-0000-000000000001',
  'Owner Without Portal',
  null
);

select ok(
  exists(
    select 1 from nodo_inmo.owners
     where id = 'e0000000-0000-0000-0000-000000000011'
       and portal_user_id is null
  ),
  'owners.portal_user_id: NULL accepted (portal not yet linked)'
);

-- Invalid: non-existent auth.users id is rejected
select throws_ok(
  $q$ insert into nodo_inmo.owners (org_id, name, portal_user_id)
      values (
        'e0000000-0000-0000-0000-000000000001',
        'Ghost Portal',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      )
  $q$,
  null, null,
  'FK portal_user_id → auth.users: non-existent user_id rejected'
);

-- -----------------------------------------------------------------------
-- 7. org_id index exists
-- -----------------------------------------------------------------------
select has_index(
  'nodo_inmo', 'owners',
  'owners_org_id_idx',
  'leading index on org_id exists'
);

-- -----------------------------------------------------------------------
-- 8. updated_at auto-touch: changes on UPDATE
-- -----------------------------------------------------------------------
do $$
declare
  t1 timestamptz;
  t2 timestamptz;
begin
  select updated_at into t1
    from nodo_inmo.owners
   where id = 'e0000000-0000-0000-0000-000000000011';

  perform pg_sleep(0.02);

  update nodo_inmo.owners
     set name = 'Owner Without Portal (updated)'
   where id = 'e0000000-0000-0000-0000-000000000011';

  select updated_at into t2
    from nodo_inmo.owners
   where id = 'e0000000-0000-0000-0000-000000000011';

  if t2 <= t1 then
    raise exception 'updated_at did not advance after UPDATE (t1=%, t2=%)', t1, t2;
  end if;
end $$;

select ok(true, 'updated_at advances on UPDATE');

-- -----------------------------------------------------------------------
-- 9. Deferred FK: properties.owner_id → nodo_inmo.owners
-- -----------------------------------------------------------------------
-- Confirm the FK now exists on properties.owner_id → owners
select col_is_fk(
  'nodo_inmo', 'properties', 'owner_id',
  'properties.owner_id is a foreign key (FK wired to owners)'
);

-- Functional check: a property can reference an owner in the same org
insert into nodo_inmo.properties
  (id, org_id, owner_id, address, operation, property_type, status, currency)
values (
  'e0000000-0000-0000-0000-000000000020',
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000010',
  'Riobamba 500', 'rent', 'apartment', 'available', 'ARS'
);

select ok(
  exists(
    select 1 from nodo_inmo.properties
     where id   = 'e0000000-0000-0000-0000-000000000020'
       and owner_id = 'e0000000-0000-0000-0000-000000000010'
  ),
  'properties.owner_id FK: property can reference an owner'
);

-- Referential integrity: non-existent owner_id is rejected
select throws_ok(
  $q$ insert into nodo_inmo.properties
        (org_id, owner_id, address, operation, property_type, status, currency)
      values (
        'e0000000-0000-0000-0000-000000000001',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'Fake Owner St', 'rent', 'apartment', 'available', 'ARS'
      )
  $q$,
  null, null,
  'properties.owner_id FK: non-existent owner_id rejected'
);

-- ON DELETE SET NULL: deleting owner nulls property.owner_id
insert into nodo_inmo.owners (id, org_id, name)
values ('e0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000001', 'Temp Owner');

insert into nodo_inmo.properties
  (id, org_id, owner_id, address, operation, property_type, status, currency)
values (
  'e0000000-0000-0000-0000-000000000021',
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000012',
  'Corrientes 9000', 'sale', 'house', 'available', 'USD'
);

delete from nodo_inmo.owners where id = 'e0000000-0000-0000-0000-000000000012';

select ok(
  exists(
    select 1 from nodo_inmo.properties
     where id = 'e0000000-0000-0000-0000-000000000021'
       and owner_id is null
  ),
  'properties.owner_id ON DELETE SET NULL: owner deleted → property.owner_id nulled'
);

-- -----------------------------------------------------------------------
-- 10. RLS — switch to authenticated role (non-vacuous: real rows in both orgs)
-- -----------------------------------------------------------------------

-- Seed owners for Org E and Org F as superuser
insert into nodo_inmo.owners (id, org_id, name) values
  ('e0000000-0000-0000-0000-000000000030', 'e0000000-0000-0000-0000-000000000001', 'Org E Owner 1'),
  ('e0000000-0000-0000-0000-000000000031', 'e0000000-0000-0000-0000-000000000001', 'Org E Owner 2'),
  ('f0000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000001', 'Org F Owner 1');

-- -----------------------------------------------------------------------
-- 10a. Cross-tenant: Org E agent sees 0 Org F owners
-- -----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.owners
    where org_id = 'f0000000-0000-0000-0000-000000000001'),
  0,
  'RLS: Org E agent sees 0 Org F owners (cross-tenant blocked)'
);

-- -----------------------------------------------------------------------
-- 10b. Template A: AGENT of Org E can INSERT
-- -----------------------------------------------------------------------
select lives_ok(
  $q$ insert into nodo_inmo.owners (org_id, name)
      values ('e0000000-0000-0000-0000-000000000001', 'Agent-created Owner')
  $q$,
  'TemplateA: agent can INSERT own org owner'
);

-- -----------------------------------------------------------------------
-- 10c. Template A: ADMIN of Org E can INSERT
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ insert into nodo_inmo.owners (org_id, name)
      values ('e0000000-0000-0000-0000-000000000001', 'Admin-created Owner')
  $q$,
  'TemplateA: admin can INSERT own org owner'
);

-- -----------------------------------------------------------------------
-- 10d. Template A: AGENT of Org E can SELECT
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.owners
    where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>',
  0,
  'TemplateA: agent can SELECT own org owners'
);

-- -----------------------------------------------------------------------
-- 10e. Template A: AGENT of Org E can UPDATE
-- -----------------------------------------------------------------------
select lives_ok(
  $q$ update nodo_inmo.owners
         set name = 'Org E Owner 1 Updated'
       where org_id = 'e0000000-0000-0000-0000-000000000001'
         and name = 'Org E Owner 1'
  $q$,
  'TemplateA: agent can UPDATE own org owner'
);

-- -----------------------------------------------------------------------
-- 10f. Template A: ADMIN of Org E can DELETE
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ delete from nodo_inmo.owners
       where org_id = 'e0000000-0000-0000-0000-000000000001'
         and name = 'Admin-created Owner'
  $q$,
  'TemplateA: admin can DELETE own org owner'
);

-- -----------------------------------------------------------------------
-- 10g. UPDATE WITH CHECK: org_id cannot be reassigned
-- -----------------------------------------------------------------------
select throws_ok(
  $q$ update nodo_inmo.owners
         set org_id = 'f0000000-0000-0000-0000-000000000001'
       where org_id = 'e0000000-0000-0000-0000-000000000001'
         and name = 'Org E Owner 2'
  $q$,
  null, null,
  'RLS: UPDATE cannot reassign org_id to another org (WITH CHECK)'
);

-- -----------------------------------------------------------------------
-- 10h. Template A vs B: AGENT is NOT blocked (confirms staff-shared)
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.owners
    where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>',
  0,
  'TemplateA (vs B): agent sees org owners — NOT blocked (staff-shared confirmed)'
);

select * from finish();
rollback;
