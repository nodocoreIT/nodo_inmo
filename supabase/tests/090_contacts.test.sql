-- Test: nodo_inmo.contacts — unified person directory (roles text[])
--
-- owners was generalized to contacts: same fields, plus roles text[] column.
-- properties.owner_id FK still exists, now references contacts.
-- Template A RLS preserved (org-scoped, staff-shared).
--
-- TDD: RED first (run against table named 'owners', before rename migration).
-- Then GREEN after the generalize_owners_to_contacts migration is applied.
begin;
select plan(31);

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
-- 1. Table exists (must be named 'contacts')
-- -----------------------------------------------------------------------
select has_table(
  'nodo_inmo', 'contacts',
  'nodo_inmo.contacts table exists'
);

-- -----------------------------------------------------------------------
-- 2. Primary key
-- -----------------------------------------------------------------------
select col_is_pk(
  'nodo_inmo', 'contacts', 'id',
  'contacts.id is the primary key'
);

-- -----------------------------------------------------------------------
-- 3. NOT NULL constraints
-- -----------------------------------------------------------------------
select col_not_null(
  'nodo_inmo', 'contacts', 'org_id',
  'contacts.org_id is NOT NULL'
);

select col_not_null(
  'nodo_inmo', 'contacts', 'name',
  'contacts.name is NOT NULL'
);

-- -----------------------------------------------------------------------
-- 4. roles column: exists, is text[], NOT NULL, default '{}'
-- -----------------------------------------------------------------------
select has_column(
  'nodo_inmo', 'contacts', 'roles',
  'contacts.roles column exists'
);

select col_not_null(
  'nodo_inmo', 'contacts', 'roles',
  'contacts.roles is NOT NULL'
);

select col_default_is(
  'nodo_inmo', 'contacts', 'roles', '{}',
  'contacts.roles defaults to empty array'
);

-- -----------------------------------------------------------------------
-- 5. roles check constraint: rejects invalid role values
-- -----------------------------------------------------------------------
select throws_ok(
  $q$ insert into nodo_inmo.contacts (org_id, name, roles)
      values (
        'e0000000-0000-0000-0000-000000000001',
        'Invalid Role Contact',
        array['superuser']
      )
  $q$,
  null, null,
  'roles check constraint: invalid role value rejected'
);

-- -----------------------------------------------------------------------
-- 6. roles check constraint: valid roles accepted
-- -----------------------------------------------------------------------
insert into nodo_inmo.contacts (id, org_id, name, roles)
values (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'Multi-role Contact',
  array['owner', 'tenant']::text[]
);

select ok(
  exists(
    select 1 from nodo_inmo.contacts
     where id = 'e0000000-0000-0000-0000-000000000001'
       and roles @> array['owner']::text[]
       and roles @> array['tenant']::text[]
  ),
  'roles: owner and tenant accepted together'
);

-- All three valid roles accepted
insert into nodo_inmo.contacts (id, org_id, name, roles)
values (
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000001',
  'Guarantor Contact',
  array['guarantor']::text[]
);

select ok(
  exists(
    select 1 from nodo_inmo.contacts
     where id = 'e0000000-0000-0000-0000-000000000002'
       and roles = array['guarantor']::text[]
  ),
  'roles: guarantor accepted as valid role'
);

-- -----------------------------------------------------------------------
-- 7. Column defaults preserved from owners
-- -----------------------------------------------------------------------
select col_default_is(
  'nodo_inmo', 'contacts', 'commission_rate', '10.00',
  'contacts.commission_rate defaults to 10.00'
);

select col_default_is(
  'nodo_inmo', 'contacts', 'can_view_rentals', 'false',
  'contacts.can_view_rentals defaults to false'
);

select col_default_is(
  'nodo_inmo', 'contacts', 'can_view_construction', 'false',
  'contacts.can_view_construction defaults to false'
);

select col_default_is(
  'nodo_inmo', 'contacts', 'can_view_sales', 'false',
  'contacts.can_view_sales defaults to false'
);

-- -----------------------------------------------------------------------
-- 8. FK: org_id → shared.organizations
-- -----------------------------------------------------------------------
select throws_ok(
  $q$ insert into nodo_inmo.contacts (org_id, name)
      values ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Ghost Contact')
  $q$,
  null, null,
  'FK org_id → shared.organizations: non-existent org_id rejected'
);

-- -----------------------------------------------------------------------
-- 9. FK: portal_user_id → auth.users (nullable)
-- -----------------------------------------------------------------------
insert into nodo_inmo.contacts (id, org_id, name, portal_user_id)
values (
  'e0000000-0000-0000-0000-000000000010',
  'e0000000-0000-0000-0000-000000000001',
  'Contact With Portal',
  'a0000000-0000-0000-0000-000000000099'
);

select ok(
  exists(
    select 1 from nodo_inmo.contacts
     where id = 'e0000000-0000-0000-0000-000000000010'
       and portal_user_id = 'a0000000-0000-0000-0000-000000000099'
  ),
  'contacts.portal_user_id: nullable FK to auth.users accepted'
);

insert into nodo_inmo.contacts (id, org_id, name, portal_user_id)
values (
  'e0000000-0000-0000-0000-000000000011',
  'e0000000-0000-0000-0000-000000000001',
  'Contact Without Portal',
  null
);

select ok(
  exists(
    select 1 from nodo_inmo.contacts
     where id = 'e0000000-0000-0000-0000-000000000011'
       and portal_user_id is null
  ),
  'contacts.portal_user_id: NULL accepted (portal not yet linked)'
);

-- -----------------------------------------------------------------------
-- 10. org_id index exists (renamed from owners_org_id_idx)
-- -----------------------------------------------------------------------
select has_index(
  'nodo_inmo', 'contacts',
  'contacts_org_id_idx',
  'leading index contacts_org_id_idx on org_id exists'
);

-- -----------------------------------------------------------------------
-- 11. roles GIN index exists
-- -----------------------------------------------------------------------
select has_index(
  'nodo_inmo', 'contacts',
  'contacts_roles_idx',
  'GIN index contacts_roles_idx on roles exists'
);

-- -----------------------------------------------------------------------
-- 12. updated_at auto-touch
-- -----------------------------------------------------------------------
do $$
declare
  t1 timestamptz;
  t2 timestamptz;
begin
  select updated_at into t1
    from nodo_inmo.contacts
   where id = 'e0000000-0000-0000-0000-000000000011';

  perform pg_sleep(0.02);

  update nodo_inmo.contacts
     set name = 'Contact Without Portal (updated)'
   where id = 'e0000000-0000-0000-0000-000000000011';

  select updated_at into t2
    from nodo_inmo.contacts
   where id = 'e0000000-0000-0000-0000-000000000011';

  if t2 <= t1 then
    raise exception 'updated_at did not advance after UPDATE (t1=%, t2=%)', t1, t2;
  end if;
end $$;

select ok(true, 'updated_at advances on UPDATE');

-- -----------------------------------------------------------------------
-- 13. properties.owner_id FK now references contacts
-- -----------------------------------------------------------------------
select col_is_fk(
  'nodo_inmo', 'properties', 'owner_id',
  'properties.owner_id is a foreign key (now references contacts)'
);

-- Functional: a property can reference a contact in the same org
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
     where id      = 'e0000000-0000-0000-0000-000000000020'
       and owner_id = 'e0000000-0000-0000-0000-000000000010'
  ),
  'properties.owner_id FK: property can reference a contact'
);

-- ON DELETE SET NULL: deleting contact nulls property.owner_id
insert into nodo_inmo.contacts (id, org_id, name)
values ('e0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000001', 'Temp Contact');

insert into nodo_inmo.properties
  (id, org_id, owner_id, address, operation, property_type, status, currency)
values (
  'e0000000-0000-0000-0000-000000000021',
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000012',
  'Corrientes 9000', 'sale', 'house', 'available', 'USD'
);

delete from nodo_inmo.contacts where id = 'e0000000-0000-0000-0000-000000000012';

select ok(
  exists(
    select 1 from nodo_inmo.properties
     where id = 'e0000000-0000-0000-0000-000000000021'
       and owner_id is null
  ),
  'properties.owner_id ON DELETE SET NULL: contact deleted → owner_id nulled'
);

-- -----------------------------------------------------------------------
-- 14. RLS — switch to authenticated role (non-vacuous: real rows in both orgs)
-- -----------------------------------------------------------------------

-- Seed contacts for Org E and Org F as superuser
insert into nodo_inmo.contacts (id, org_id, name, roles) values
  ('e0000000-0000-0000-0000-000000000030', 'e0000000-0000-0000-0000-000000000001', 'Org E Contact 1', array['owner']::text[]),
  ('e0000000-0000-0000-0000-000000000031', 'e0000000-0000-0000-0000-000000000001', 'Org E Contact 2', array['tenant']::text[]),
  ('f0000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000001', 'Org F Contact 1', array['owner']::text[]);

-- -----------------------------------------------------------------------
-- 14a. Cross-tenant: Org E agent sees 0 Org F contacts
-- -----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.contacts
    where org_id = 'f0000000-0000-0000-0000-000000000001'),
  0,
  'RLS: Org E agent sees 0 Org F contacts (cross-tenant blocked)'
);

-- -----------------------------------------------------------------------
-- 14b. Template A: AGENT of Org E can INSERT
-- -----------------------------------------------------------------------
select lives_ok(
  $q$ insert into nodo_inmo.contacts (org_id, name)
      values ('e0000000-0000-0000-0000-000000000001', 'Agent-created Contact')
  $q$,
  'TemplateA: agent can INSERT own org contact'
);

-- -----------------------------------------------------------------------
-- 14c. Template A: ADMIN of Org E can INSERT
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ insert into nodo_inmo.contacts (org_id, name)
      values ('e0000000-0000-0000-0000-000000000001', 'Admin-created Contact')
  $q$,
  'TemplateA: admin can INSERT own org contact'
);

-- -----------------------------------------------------------------------
-- 14d. Template A: AGENT of Org E can SELECT
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.contacts
    where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>',
  0,
  'TemplateA: agent can SELECT own org contacts'
);

-- -----------------------------------------------------------------------
-- 14e. Template A: AGENT of Org E can UPDATE
-- -----------------------------------------------------------------------
select lives_ok(
  $q$ update nodo_inmo.contacts
         set name = 'Org E Contact 1 Updated'
       where org_id = 'e0000000-0000-0000-0000-000000000001'
         and name = 'Org E Contact 1'
  $q$,
  'TemplateA: agent can UPDATE own org contact'
);

-- -----------------------------------------------------------------------
-- 14f. Template A: ADMIN of Org E can DELETE
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ delete from nodo_inmo.contacts
       where org_id = 'e0000000-0000-0000-0000-000000000001'
         and name = 'Admin-created Contact'
  $q$,
  'TemplateA: admin can DELETE own org contact'
);

-- -----------------------------------------------------------------------
-- 14g. UPDATE WITH CHECK: org_id cannot be reassigned
-- -----------------------------------------------------------------------
select throws_ok(
  $q$ update nodo_inmo.contacts
         set org_id = 'f0000000-0000-0000-0000-000000000001'
       where org_id = 'e0000000-0000-0000-0000-000000000001'
         and name = 'Org E Contact 2'
  $q$,
  null, null,
  'RLS: UPDATE cannot reassign org_id to another org (WITH CHECK)'
);

-- -----------------------------------------------------------------------
-- 14h. Template A vs B: AGENT is NOT blocked (confirms staff-shared)
-- -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.contacts
    where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>',
  0,
  'TemplateA (vs B): agent sees org contacts — NOT blocked (staff-shared confirmed)'
);

select * from finish();
rollback;
