-- Test: nodo_inmo.cash_movements + nodo_inmo.owner_settlements (Caja)
--
-- ADMIN-ONLY (Template B): org-scoped AND role = 'admin'. Agents are blocked.
--
-- TDD: RED first (tables do not exist), GREEN after create_caja migration.
begin;
select plan(37);

-- -----------------------------------------------------------------------
-- Seed: one org, an admin + an agent, and the cobro chain (property → contract → payment)
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('e1000000-0000-0000-0000-000000000001', 'admin-c@test.local', 'x', now(), now()),
  ('e2000000-0000-0000-0000-000000000002', 'agent-c@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('e0000000-0000-0000-0000-000000000001', 'Org C', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'admin'),
  ('e0000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'agent');

insert into nodo_inmo.contacts (id, org_id, name, roles) values
  ('c0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'Owner C',  array['owner']::text[]),
  ('c0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000001', 'Tenant C', array['tenant']::text[]);

insert into nodo_inmo.properties (id, org_id, owner_id, address, operation, property_type, status, currency) values
  ('d0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', 'Roca 100', 'rent', 'apartment', 'available', 'ARS');

insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount) values
  ('a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000b1', '2026-01-01', '2027-01-01', 250000);

insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('a0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', '2026-01-01', '2026-01-10', 250000);

-- =======================================================================
-- A. owner_settlements — structure
-- =======================================================================
select has_table('nodo_inmo', 'owner_settlements', 'owner_settlements table exists');
select col_is_pk('nodo_inmo', 'owner_settlements', 'id', 'owner_settlements.id is the PK');
select col_not_null('nodo_inmo', 'owner_settlements', 'org_id',     'owner_settlements.org_id NOT NULL');
select col_not_null('nodo_inmo', 'owner_settlements', 'owner_id',   'owner_settlements.owner_id NOT NULL');
select col_not_null('nodo_inmo', 'owner_settlements', 'payment_id', 'owner_settlements.payment_id NOT NULL');
select col_not_null('nodo_inmo', 'owner_settlements', 'amount',     'owner_settlements.amount NOT NULL');
select col_not_null('nodo_inmo', 'owner_settlements', 'status',     'owner_settlements.status NOT NULL');
select col_default_is('nodo_inmo', 'owner_settlements', 'status', 'pending', 'owner_settlements.status defaults to pending');

select throws_ok(
  $q$ insert into nodo_inmo.owner_settlements (org_id, owner_id, payment_id, amount, status)
      values ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-0000000000b1',225000,'paid') $q$,
  null, null, 'owner_settlements.status check: invalid value rejected');

select col_is_fk('nodo_inmo', 'owner_settlements', 'owner_id',   'owner_settlements.owner_id is a FK');
select col_is_fk('nodo_inmo', 'owner_settlements', 'payment_id', 'owner_settlements.payment_id is a FK');

select lives_ok(
  $q$ insert into nodo_inmo.owner_settlements (id, org_id, owner_id, payment_id, amount)
      values ('a0000000-0000-0000-0000-0000000000c1','e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-0000000000b1',225000) $q$,
  'valid owner_settlement insert succeeds');

select throws_ok(
  $q$ insert into nodo_inmo.owner_settlements (org_id, owner_id, payment_id, amount)
      values ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-0000000000b1',225000) $q$,
  null, null, 'unique (payment_id): one settlement per cobro');

select has_index('nodo_inmo', 'owner_settlements', 'owner_settlements_status_idx', 'owner_settlements_status_idx exists');

do $$
declare t1 timestamptz; t2 timestamptz;
begin
  select updated_at into t1 from nodo_inmo.owner_settlements where id = 'a0000000-0000-0000-0000-0000000000c1';
  perform pg_sleep(0.02);
  update nodo_inmo.owner_settlements set status = 'settled', settled_date = current_date where id = 'a0000000-0000-0000-0000-0000000000c1';
  select updated_at into t2 from nodo_inmo.owner_settlements where id = 'a0000000-0000-0000-0000-0000000000c1';
  if t2 <= t1 then raise exception 'updated_at did not advance'; end if;
end $$;
select ok(true, 'owner_settlements.updated_at advances on UPDATE');

-- =======================================================================
-- B. cash_movements — structure
-- =======================================================================
select has_table('nodo_inmo', 'cash_movements', 'cash_movements table exists');
select col_is_pk('nodo_inmo', 'cash_movements', 'id', 'cash_movements.id is the PK');
select col_not_null('nodo_inmo', 'cash_movements', 'org_id',  'cash_movements.org_id NOT NULL');
select col_not_null('nodo_inmo', 'cash_movements', 'type',    'cash_movements.type NOT NULL');
select col_not_null('nodo_inmo', 'cash_movements', 'amount',  'cash_movements.amount NOT NULL');
select col_not_null('nodo_inmo', 'cash_movements', 'concept', 'cash_movements.concept NOT NULL');
select col_default_is('nodo_inmo', 'cash_movements', 'source',   'manual', 'cash_movements.source defaults to manual');
select col_default_is('nodo_inmo', 'cash_movements', 'currency', 'ARS',    'cash_movements.currency defaults to ARS');

select throws_ok(
  $q$ insert into nodo_inmo.cash_movements (org_id, type, amount, concept)
      values ('e0000000-0000-0000-0000-000000000001','refund',1000,'x') $q$,
  null, null, 'cash_movements.type check: invalid type rejected');

select throws_ok(
  $q$ insert into nodo_inmo.cash_movements (org_id, type, amount, concept)
      values ('e0000000-0000-0000-0000-000000000001','income',-5,'x') $q$,
  null, null, 'cash_movements.amount check: negative rejected');

select throws_ok(
  $q$ insert into nodo_inmo.cash_movements (org_id, type, amount, concept, source)
      values ('e0000000-0000-0000-0000-000000000001','income',1000,'x','bribe') $q$,
  null, null, 'cash_movements.source check: invalid source rejected');

select has_index('nodo_inmo', 'cash_movements', 'cash_movements_date_idx', 'cash_movements_date_idx exists');

select lives_ok(
  $q$ insert into nodo_inmo.cash_movements (id, org_id, type, amount, concept, source, payment_id)
      values ('a0000000-0000-0000-0000-0000000000d1','e0000000-0000-0000-0000-000000000001','income',25000,'Comisión Ene 2026','commission','a0000000-0000-0000-0000-0000000000b1') $q$,
  'valid cash_movement insert succeeds');

do $$
declare t1 timestamptz; t2 timestamptz;
begin
  select updated_at into t1 from nodo_inmo.cash_movements where id = 'a0000000-0000-0000-0000-0000000000d1';
  perform pg_sleep(0.02);
  update nodo_inmo.cash_movements set concept = 'Comisión Ene 2026 (edit)' where id = 'a0000000-0000-0000-0000-0000000000d1';
  select updated_at into t2 from nodo_inmo.cash_movements where id = 'a0000000-0000-0000-0000-0000000000d1';
  if t2 <= t1 then raise exception 'updated_at did not advance'; end if;
end $$;
select ok(true, 'cash_movements.updated_at advances on UPDATE');

-- =======================================================================
-- C. RLS — Template B (admin-only)
-- =======================================================================
set local role authenticated;

-- Agent: blocked entirely
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.cash_movements where org_id = 'e0000000-0000-0000-0000-000000000001'),
  0, 'TemplateB: agent sees 0 cash_movements (admin-only)');

select throws_ok(
  $q$ insert into nodo_inmo.cash_movements (org_id, type, amount, concept)
      values ('e0000000-0000-0000-0000-000000000001','income',1000,'agent attempt') $q$,
  null, null, 'TemplateB: agent INSERT into cash_movements blocked');

select is(
  (select count(*)::int from nodo_inmo.owner_settlements where org_id = 'e0000000-0000-0000-0000-000000000001'),
  0, 'TemplateB: agent sees 0 owner_settlements (admin-only)');

-- Admin: full access
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"e0000000-0000-0000-0000-000000000001","role":"admin"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.cash_movements where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>', 0, 'TemplateB: admin sees cash_movements');

select lives_ok(
  $q$ insert into nodo_inmo.cash_movements (org_id, type, amount, concept)
      values ('e0000000-0000-0000-0000-000000000001','expense',20000,'Gastos oficina') $q$,
  'TemplateB: admin can INSERT cash_movements');

select cmp_ok(
  (select count(*)::int from nodo_inmo.owner_settlements where org_id = 'e0000000-0000-0000-0000-000000000001'),
  '>', 0, 'TemplateB: admin sees owner_settlements');

select lives_ok(
  $q$ update nodo_inmo.owner_settlements set status = 'settled', settled_date = current_date
       where id = 'a0000000-0000-0000-0000-0000000000c1' $q$,
  'TemplateB: admin can UPDATE owner_settlements (mark settled)');

select throws_ok(
  $q$ update nodo_inmo.cash_movements set org_id = 'f0000000-0000-0000-0000-000000000099'
       where id = 'a0000000-0000-0000-0000-0000000000d1' $q$,
  null, null, 'RLS: UPDATE cannot reassign org_id (WITH CHECK)');

select * from finish();
rollback;
