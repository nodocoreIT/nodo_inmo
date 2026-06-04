-- Test: nodo_inmo.payments — rent installments (cuotas)
--
-- One row per contract per period. Template A (staff-shared) RLS, org-scoped.
-- Cascades from its contract. "Overdue" is derived, not stored.
--
-- TDD: RED first (table does not exist), GREEN after create_payments migration.
begin;
select plan(31);

-- -----------------------------------------------------------------------
-- Seed: two orgs + users + a contract each
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

insert into nodo_inmo.contacts (id, org_id, name, roles) values
  ('cc000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-000000000001', 'Tenant E', array['tenant']::text[]),
  ('cc000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-000000000001', 'Tenant F', array['tenant']::text[]);

insert into nodo_inmo.properties (id, org_id, address, operation, property_type, status, currency) values
  ('dd000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-000000000001', 'Lavalle 100', 'rent', 'apartment', 'available', 'ARS'),
  ('dd000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-000000000001', 'Mitre 200',   'rent', 'house',     'available', 'ARS');

insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount) values
  ('aa000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-0000000000e1', 'cc000000-0000-0000-0000-0000000000e1', '2026-01-01', '2028-01-01', 250000),
  ('aa000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-0000000000f1', 'cc000000-0000-0000-0000-0000000000f1', '2026-01-01', '2028-01-01', 300000);

-- =======================================================================
-- A. Structure
-- =======================================================================
select has_table('nodo_inmo', 'payments', 'nodo_inmo.payments table exists');
select col_is_pk('nodo_inmo', 'payments', 'id', 'payments.id is the primary key');

select col_not_null('nodo_inmo', 'payments', 'org_id',      'payments.org_id is NOT NULL');
select col_not_null('nodo_inmo', 'payments', 'contract_id', 'payments.contract_id is NOT NULL');
select col_not_null('nodo_inmo', 'payments', 'period',      'payments.period is NOT NULL');
select col_not_null('nodo_inmo', 'payments', 'due_date',    'payments.due_date is NOT NULL');
select col_not_null('nodo_inmo', 'payments', 'amount',      'payments.amount is NOT NULL');
select col_not_null('nodo_inmo', 'payments', 'currency',    'payments.currency is NOT NULL');
select col_not_null('nodo_inmo', 'payments', 'status',      'payments.status is NOT NULL');

select col_default_is('nodo_inmo', 'payments', 'currency', 'ARS',     'payments.currency defaults to ARS');
select col_default_is('nodo_inmo', 'payments', 'status',   'pending', 'payments.status defaults to pending');

select throws_ok(
  $q$ insert into nodo_inmo.payments (org_id, contract_id, period, due_date, amount, currency)
      values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','2026-02-01','2026-02-10',250000,'EUR') $q$,
  null, null, 'currency check: EUR rejected');

select throws_ok(
  $q$ insert into nodo_inmo.payments (org_id, contract_id, period, due_date, amount, status)
      values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','2026-03-01','2026-03-10',250000,'late') $q$,
  null, null, 'status check: unknown status rejected');

select throws_ok(
  $q$ insert into nodo_inmo.payments (org_id, contract_id, period, due_date, amount, payment_method)
      values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','2026-04-01','2026-04-10',250000,'crypto') $q$,
  null, null, 'payment_method check: invalid value rejected');

select col_is_fk('nodo_inmo', 'payments', 'org_id',      'payments.org_id is a foreign key');
select col_is_fk('nodo_inmo', 'payments', 'contract_id', 'payments.contract_id is a foreign key');

select throws_ok(
  $q$ insert into nodo_inmo.payments (org_id, contract_id, period, due_date, amount)
      values ('e0000000-0000-0000-0000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','2026-05-01','2026-05-10',250000) $q$,
  null, null, 'FK contract_id: non-existent contract rejected');

select has_index('nodo_inmo', 'payments', 'payments_org_id_idx',      'payments_org_id_idx exists');
select has_index('nodo_inmo', 'payments', 'payments_contract_id_idx', 'payments_contract_id_idx exists');
select has_index('nodo_inmo', 'payments', 'payments_due_date_idx',    'payments_due_date_idx exists');

-- Valid insert
select lives_ok(
  $q$ insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount, currency, status)
      values ('ba000000-0000-0000-0000-0000000000e1','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','2026-01-01','2026-01-10',250000,'ARS','pending') $q$,
  'valid installment insert succeeds');

-- unique (contract_id, period)
select throws_ok(
  $q$ insert into nodo_inmo.payments (org_id, contract_id, period, due_date, amount)
      values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','2026-01-01','2026-01-10',250000) $q$,
  null, null, 'unique (contract_id, period): duplicate installment rejected');

-- updated_at advances
do $$
declare t1 timestamptz; t2 timestamptz;
begin
  select updated_at into t1 from nodo_inmo.payments where id = 'ba000000-0000-0000-0000-0000000000e1';
  perform pg_sleep(0.02);
  update nodo_inmo.payments set status = 'paid', paid_date = '2026-01-08', paid_amount = 250000 where id = 'ba000000-0000-0000-0000-0000000000e1';
  select updated_at into t2 from nodo_inmo.payments where id = 'ba000000-0000-0000-0000-0000000000e1';
  if t2 <= t1 then raise exception 'updated_at did not advance (t1=%, t2=%)', t1, t2; end if;
end $$;
select ok(true, 'payments.updated_at advances on UPDATE');

-- ON DELETE CASCADE from contract
do $$
begin
  insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount)
    values ('aa000000-0000-0000-0000-0000000000e2','e0000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-0000000000e1','cc000000-0000-0000-0000-0000000000e1','2026-01-01','2027-01-01',100000);
  insert into nodo_inmo.payments (org_id, contract_id, period, due_date, amount)
    values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e2','2026-01-01','2026-01-10',100000);
  delete from nodo_inmo.contracts where id = 'aa000000-0000-0000-0000-0000000000e2';
end $$;
select is(
  (select count(*)::int from nodo_inmo.payments where contract_id = 'aa000000-0000-0000-0000-0000000000e2'),
  0, 'ON DELETE CASCADE: deleting a contract removes its installments');

-- =======================================================================
-- B. RLS — Template A (staff-shared)
-- =======================================================================

-- Seed an Org F installment as superuser
insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount)
values ('ba000000-0000-0000-0000-0000000000f1','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000f1','2026-01-01','2026-01-10',300000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.payments where org_id = 'f0000000-0000-0000-0000-000000000001'),
  0, 'RLS: Org E agent sees 0 Org F installments (cross-tenant blocked)');

select lives_ok(
  $q$ insert into nodo_inmo.payments (org_id, contract_id, period, due_date, amount)
      values ('e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','2026-06-01','2026-06-10',250000) $q$,
  'TemplateA: agent can INSERT own org installment');

set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount)
      values ('ba000000-0000-0000-0000-0000000000e7','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-0000000000e1','2026-07-01','2026-07-10',250000) $q$,
  'TemplateA: admin can INSERT own org installment');

set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.payments where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>', 0, 'TemplateA: agent can SELECT own org installments');

select lives_ok(
  $q$ update nodo_inmo.payments set status = 'paid', paid_date = '2026-06-09', paid_amount = 250000
       where period = '2026-06-01' and org_id = 'e0000000-0000-0000-0000-000000000001' $q$,
  'TemplateA: agent can UPDATE own org installment (mark paid)');

select throws_ok(
  $q$ update nodo_inmo.payments set org_id = 'f0000000-0000-0000-0000-000000000001'
       where id = 'ba000000-0000-0000-0000-0000000000e1' $q$,
  null, null, 'RLS: UPDATE cannot reassign org_id to another org (WITH CHECK)');

set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select lives_ok(
  $q$ delete from nodo_inmo.payments where id = 'ba000000-0000-0000-0000-0000000000e7' $q$,
  'TemplateA: admin can DELETE own org installment');

select * from finish();
rollback;
