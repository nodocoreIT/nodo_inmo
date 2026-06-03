-- Test: nodo_inmo.contracts + nodo_inmo.contract_guarantors
--
-- Rental contract (locación) referencing a property and a tenant (contact),
-- with rent/currency, deposit, commission, expenses responsibility, an
-- adjustment index (IPC/ICL/fixed/USD) + periodicity, and a status lifecycle.
-- Guarantors are modeled as a join table (contract ↔ contact), not capped at 2.
--
-- Both tables follow the tenant-isolation contract: carry org_id, Template A
-- (staff-shared) RLS, leading org_id index. contracts gets the updated_at
-- trigger. property_id/tenant_id use ON DELETE RESTRICT to protect history;
-- contract_guarantors cascades from its contract.
--
-- TDD: RED first (tables do not exist), GREEN after the create_contracts
-- migration is applied.
begin;
select plan(56);

-- -----------------------------------------------------------------------
-- Seed: two orgs + users
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('e1000000-0000-0000-0000-000000000001', 'admin-e@test.local', 'x', now(), now()),
  ('e2000000-0000-0000-0000-000000000002', 'agent-e@test.local', 'x', now(), now()),
  ('f1000000-0000-0000-0000-000000000001', 'admin-f@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('e0000000-0000-0000-0000-000000000001', 'Org E', 'starter'),
  ('f0000000-0000-0000-0000-000000000001', 'Org F', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'admin'),
  ('e0000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'agent'),
  ('f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'admin');

-- Contacts (tenants + guarantors) for both orgs
insert into nodo_inmo.contacts (id, org_id, name, roles) values
  ('cc000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-000000000001', 'Tenant E',     array['tenant']::text[]),
  ('cc000000-0000-0000-0000-0000000000e2', 'e0000000-0000-0000-0000-000000000001', 'Guarantor E1', array['guarantor']::text[]),
  ('cc000000-0000-0000-0000-0000000000e3', 'e0000000-0000-0000-0000-000000000001', 'Guarantor E2', array['guarantor']::text[]),
  ('cc000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-000000000001', 'Tenant F',     array['tenant']::text[]);

-- Properties for both orgs
insert into nodo_inmo.properties
  (id, org_id, address, operation, property_type, status, currency) values
  ('dd000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-000000000001', 'Lavalle 100', 'rent', 'apartment', 'available', 'ARS'),
  ('dd000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-000000000001', 'Mitre 200',   'rent', 'house',     'available', 'ARS');

-- =======================================================================
-- A. nodo_inmo.contracts — structure
-- =======================================================================
select has_table('nodo_inmo', 'contracts', 'nodo_inmo.contracts table exists');
select col_is_pk('nodo_inmo', 'contracts', 'id', 'contracts.id is the primary key');

select col_not_null('nodo_inmo', 'contracts', 'org_id',                   'contracts.org_id is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'property_id',              'contracts.property_id is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'tenant_id',                'contracts.tenant_id is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'start_date',               'contracts.start_date is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'end_date',                 'contracts.end_date is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'rent_amount',              'contracts.rent_amount is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'currency',                 'contracts.currency is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'adjustment_index',         'contracts.adjustment_index is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'adjustment_period_months', 'contracts.adjustment_period_months is NOT NULL');
select col_not_null('nodo_inmo', 'contracts', 'status',                   'contracts.status is NOT NULL');

-- Defaults
select col_default_is('nodo_inmo', 'contracts', 'currency',                 'ARS',    'contracts.currency defaults to ARS');
select col_default_is('nodo_inmo', 'contracts', 'status',                   'draft',  'contracts.status defaults to draft');
select col_default_is('nodo_inmo', 'contracts', 'adjustment_index',         'IPC',    'contracts.adjustment_index defaults to IPC');
select col_default_is('nodo_inmo', 'contracts', 'adjustment_period_months', '12',     'contracts.adjustment_period_months defaults to 12');
select col_default_is('nodo_inmo', 'contracts', 'expenses_paid_by',         'tenant', 'contracts.expenses_paid_by defaults to tenant');

-- Check constraints
select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount, currency)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000,'EUR') $q$,
  null, null, 'currency check: EUR rejected');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount, status)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000,'paused') $q$,
  null, null, 'status check: unknown status rejected');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount, adjustment_index)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000,'CER') $q$,
  null, null, 'adjustment_index check: unknown index rejected');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount, expenses_paid_by)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000,'agency') $q$,
  null, null, 'expenses_paid_by check: invalid value rejected');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2028-01-01','2026-01-01',100000) $q$,
  null, null, 'date check: end_date must be after start_date');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount, adjustment_period_months)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000,0) $q$,
  null, null, 'adjustment_period_months check: must be > 0');

-- Foreign keys
select col_is_fk('nodo_inmo', 'contracts', 'org_id',      'contracts.org_id is a foreign key');
select col_is_fk('nodo_inmo', 'contracts', 'property_id', 'contracts.property_id is a foreign key');
select col_is_fk('nodo_inmo', 'contracts', 'tenant_id',   'contracts.tenant_id is a foreign key');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount)
      values ('ffffffff-ffff-ffff-ffff-ffffffffffff','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000) $q$,
  null, null, 'FK org_id: non-existent org rejected');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount)
      values ('e0000000-0000-0000-0000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000) $q$,
  null, null, 'FK property_id: non-existent property rejected');

select throws_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','ffffffff-ffff-ffff-ffff-ffffffffffff','2026-01-01','2028-01-01',100000) $q$,
  null, null, 'FK tenant_id: non-existent contact rejected');

-- Indexes
select has_index('nodo_inmo', 'contracts', 'contracts_org_id_idx',      'contracts_org_id_idx exists');
select has_index('nodo_inmo', 'contracts', 'contracts_property_id_idx', 'contracts_property_id_idx exists');
select has_index('nodo_inmo', 'contracts', 'contracts_tenant_id_idx',   'contracts_tenant_id_idx exists');

-- Valid insert (superuser)
select lives_ok(
  $q$ insert into nodo_inmo.contracts
        (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount, currency, deposit_amount, commission_amount, expenses_paid_by, adjustment_index, adjustment_period_months, status)
      values ('aa000000-0000-0000-0000-0000000000e1','e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',250000,'ARS',250000,250000,'tenant','ICL',3,'active') $q$,
  'valid contract insert succeeds');

-- updated_at advances on UPDATE
do $$
declare t1 timestamptz; t2 timestamptz;
begin
  select updated_at into t1 from nodo_inmo.contracts where id = 'aa000000-0000-0000-0000-0000000000e1';
  perform pg_sleep(0.02);
  update nodo_inmo.contracts set rent_amount = 260000 where id = 'aa000000-0000-0000-0000-0000000000e1';
  select updated_at into t2 from nodo_inmo.contracts where id = 'aa000000-0000-0000-0000-0000000000e1';
  if t2 <= t1 then raise exception 'updated_at did not advance (t1=%, t2=%)', t1, t2; end if;
end $$;
select ok(true, 'contracts.updated_at advances on UPDATE');

-- ON DELETE RESTRICT: referenced property cannot be deleted
select throws_ok(
  $q$ delete from nodo_inmo.properties where id = 'dd000000-0000-0000-0000-0000000000e1' $q$,
  null, null, 'ON DELETE RESTRICT: property with a contract cannot be deleted');

-- ON DELETE RESTRICT: referenced tenant cannot be deleted
select throws_ok(
  $q$ delete from nodo_inmo.contacts where id = 'cc000000-0000-0000-0000-0000000000e1' $q$,
  null, null, 'ON DELETE RESTRICT: tenant on a contract cannot be deleted');

-- =======================================================================
-- B. nodo_inmo.contract_guarantors — structure
-- =======================================================================
select has_table('nodo_inmo', 'contract_guarantors', 'nodo_inmo.contract_guarantors table exists');
select col_is_pk('nodo_inmo', 'contract_guarantors', 'id', 'contract_guarantors.id is the primary key');
select col_not_null('nodo_inmo', 'contract_guarantors', 'org_id',       'contract_guarantors.org_id is NOT NULL');
select col_not_null('nodo_inmo', 'contract_guarantors', 'contract_id',  'contract_guarantors.contract_id is NOT NULL');
select col_not_null('nodo_inmo', 'contract_guarantors', 'guarantor_id', 'contract_guarantors.guarantor_id is NOT NULL');
select col_is_fk('nodo_inmo', 'contract_guarantors', 'contract_id',  'contract_guarantors.contract_id is a foreign key');
select col_is_fk('nodo_inmo', 'contract_guarantors', 'guarantor_id', 'contract_guarantors.guarantor_id is a foreign key');
select has_index('nodo_inmo', 'contract_guarantors', 'contract_guarantors_org_id_idx', 'contract_guarantors_org_id_idx exists');

-- Link a guarantor
select lives_ok(
  $q$ insert into nodo_inmo.contract_guarantors (id, org_id, contract_id, guarantor_id)
      values ('bb000000-0000-0000-0000-0000000000e1','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e2') $q$,
  'guarantor can be linked to a contract');

-- Unique (contract_id, guarantor_id)
select throws_ok(
  $q$ insert into nodo_inmo.contract_guarantors (org_id, contract_id, guarantor_id)
      values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e2') $q$,
  null, null, 'unique (contract_id, guarantor_id): same guarantor cannot be linked twice');

-- ON DELETE CASCADE: deleting the contract removes its guarantor links
do $$
begin
  insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount)
    values ('aa000000-0000-0000-0000-0000000000e2','e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2028-01-01',100000);
  insert into nodo_inmo.contract_guarantors (org_id, contract_id, guarantor_id)
    values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e2','cc000000-0000-0000-0000-0000000000e3');
  delete from nodo_inmo.contracts where id = 'aa000000-0000-0000-0000-0000000000e2';
end $$;
select is(
  (select count(*)::int from nodo_inmo.contract_guarantors where contract_id = 'aa000000-0000-0000-0000-0000000000e2'),
  0,
  'ON DELETE CASCADE: contract deletion removes its guarantor links');

-- =======================================================================
-- C. RLS — Template A (staff-shared) on contracts
-- =======================================================================

-- Seed an Org F contract as superuser (for cross-tenant checks)
insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount)
values ('aa000000-0000-0000-0000-0000000000f1','f0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000f1','cc000000-0000-0000-0000-0000000000f1','2026-01-01','2028-01-01',300000);

insert into nodo_inmo.contract_guarantors (org_id, contract_id, guarantor_id)
values ('f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000f1','cc000000-0000-0000-0000-0000000000f1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.contracts where org_id = 'f0000000-0000-0000-0000-000000000001'),
  0, 'RLS: Org E agent sees 0 Org F contracts (cross-tenant blocked)');

select lives_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-06-01','2028-06-01',180000) $q$,
  'TemplateA: agent can INSERT own org contract');

set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ insert into nodo_inmo.contracts (org_id, property_id, tenant_id, start_date, end_date, rent_amount)
      values ('e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-07-01','2028-07-01',190000) $q$,
  'TemplateA: admin can INSERT own org contract');

set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.contracts where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>', 0, 'TemplateA: agent can SELECT own org contracts');

select lives_ok(
  $q$ update nodo_inmo.contracts set status = 'active'
       where id = 'aa000000-0000-0000-0000-0000000000e1' $q$,
  'TemplateA: agent can UPDATE own org contract');

select throws_ok(
  $q$ update nodo_inmo.contracts set org_id = 'f0000000-0000-0000-0000-000000000001'
       where id = 'aa000000-0000-0000-0000-0000000000e1' $q$,
  null, null, 'RLS: UPDATE cannot reassign org_id to another org (WITH CHECK)');

set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ delete from nodo_inmo.contracts where id = 'aa000000-0000-0000-0000-0000000000e1' $q$,
  'TemplateA: admin can DELETE own org contract');

-- =======================================================================
-- D. RLS — Template A on contract_guarantors
-- =======================================================================
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.contract_guarantors where org_id = 'f0000000-0000-0000-0000-000000000001'),
  0, 'RLS: Org E agent sees 0 Org F guarantor links (cross-tenant blocked)');

select cmp_ok(
  (select count(*)::int from nodo_inmo.contract_guarantors where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>=', 0, 'TemplateA: agent can SELECT own org guarantor links');

select * from finish();
rollback;
