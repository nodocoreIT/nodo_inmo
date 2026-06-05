-- Test: nodo_inmo.settle_owner RPC — breakdown sealing (PR-B)
--
-- Critical tests:
--   1. Schema / shape assertions (columns + indexes)
--   2. Commission property-first rule (updated trigger)
--   3. Golden case — atomic seal with correct breakdown arithmetic
--   4. No-double-count on second seal (headline correctness gate)
--   5. Seal-once guard (ADR-7)
--   6. Rollback on mid-seal failure (atomicity proof)
--   7. Authorization (agent blocked, wrong-org blocked)
--
-- TDD: RED first (columns/RPC do not exist), GREEN after B-WU2 migration.
-- Follows the style of 120_caja.test.sql and 140_property_expenses.test.sql.
begin;
select plan(38);

-- -----------------------------------------------------------------------
-- Seed: org G (admin + agent), org H (wrong-org admin), owner + two properties,
-- paid payments (trigger already fired), expenses with varied flags.
-- -----------------------------------------------------------------------

insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('b1000000-0000-0000-0000-000000000001', 'admin-g@test.local',     'x', now(), now()),
  ('b2000000-0000-0000-0000-000000000002', 'agent-g@test.local',     'x', now(), now()),
  ('b3000000-0000-0000-0000-000000000003', 'admin-h@test.local',     'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('b0000000-0000-0000-0000-000000000001', 'Org G', 'starter'),
  ('b0000000-0000-0000-0000-000000000002', 'Org H', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'admin'),
  ('b0000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'agent'),
  ('b0000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000003', 'admin');

-- Owner contact: commission_rate = 8% (fallback).
insert into nodo_inmo.contacts (id, org_id, name, roles, commission_rate) values
  ('b0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-000000000001', 'Owner G',  array['owner']::text[], 8.00),
  ('b0000000-0000-0000-0000-0000000000a2', 'b0000000-0000-0000-0000-000000000001', 'Tenant G', array['tenant']::text[], 0);

-- Property b1: explicit commission_rate = 10% (overrides contact 8%)
-- Property b2: NULL commission_rate → fallback to contact 8%
insert into nodo_inmo.properties (id, org_id, owner_id, address, operation, property_type, status, currency, commission_rate) values
  ('b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000a1', 'Calle G 100', 'rent', 'apartment', 'available', 'ARS', 10.00),
  ('b0000000-0000-0000-0000-0000000000b2', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000a1', 'Calle G 200', 'rent', 'apartment', 'available', 'ARS', null);

insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount) values
  ('b0000000-0000-0000-0000-0000000000c1', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000a2', '2026-01-01', '2027-01-01', 250000),
  ('b0000000-0000-0000-0000-0000000000c2', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000b2', 'b0000000-0000-0000-0000-0000000000a2', '2026-01-01', '2027-01-01', 100000);

-- Two payments for property b1 (10% rate). Amounts: 250000 each.
insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('b0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000c1', '2026-01-01', '2026-01-10', 250000),
  ('b0000000-0000-0000-0000-0000000000d2', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000c1', '2026-02-01', '2026-02-10', 250000);

-- Payment for property b2 (NULL rate → fallback 8%). Amount: 100000.
insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('b0000000-0000-0000-0000-0000000000d3', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000c2', '2026-01-01', '2026-01-10', 100000);

-- Mark payments paid → trigger fires
update nodo_inmo.payments set status = 'paid', paid_date = '2026-01-08'
  where id in (
    'b0000000-0000-0000-0000-0000000000d1',
    'b0000000-0000-0000-0000-0000000000d2',
    'b0000000-0000-0000-0000-0000000000d3'
  );

-- WARNING-2: property commission_rate is NULL and contact commission_rate is 0 (the minimum
-- allowed by the NOT-NULL constraint with default 10.00). Tests the documented fallback:
-- coalesce(p.commission_rate=NULL, coalesce(ct.commission_rate=0, 0)) = 0.
-- Defined behavior: commission = 0, owner_share = full amount.
-- Note: contacts.commission_rate has a NOT-NULL constraint; setting it to 0 is the closest
-- testable proxy for the "effectively zero commission" path described in the spec.
-- d6: property b3 NULL rate + contact a3 rate=0.00 → 80000 * 0% = 0
insert into nodo_inmo.contacts (id, org_id, name, roles, commission_rate) values
  ('b0000000-0000-0000-0000-0000000000a3', 'b0000000-0000-0000-0000-000000000001', 'Owner Zero-Rate', array['owner']::text[], 0.00);

insert into nodo_inmo.properties (id, org_id, owner_id, address, operation, property_type, status, currency, commission_rate) values
  ('b0000000-0000-0000-0000-0000000000b3', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000a3', 'Calle G 300', 'rent', 'apartment', 'available', 'ARS', null);

insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount) values
  ('b0000000-0000-0000-0000-0000000000c3', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000b3', 'b0000000-0000-0000-0000-0000000000a2', '2026-01-01', '2027-01-01', 80000);

insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('b0000000-0000-0000-0000-0000000000d6', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000c3', '2026-01-01', '2026-01-10', 80000);

update nodo_inmo.payments set status = 'paid', paid_date = '2026-01-09'
  where id = 'b0000000-0000-0000-0000-0000000000d6';

-- Property-expense fixtures:
-- E1: ARS, charged_to_owner = true  → consumed by ARS seal
-- E2: USD, charged_to_owner = true  → NOT consumed by ARS seal
-- E3: ARS, charged_to_owner = false → NEVER consumed
insert into nodo_inmo.property_expenses
  (id, org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
values
  ('b0000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000b1', 'arreglo', 12000.00, 'ARS', '2026-05-14', 'Plomeria B1', true),
  ('b0000000-0000-0000-0000-0000000000e2', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000b1', 'compra_accesorio', 500.00, 'USD', '2026-05-20', 'Accesorio USD', true),
  ('b0000000-0000-0000-0000-0000000000e3', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000b1', 'arreglo', 5000.00, 'ARS', '2026-05-21', 'No es del owner', false);

-- -----------------------------------------------------------------------
-- A. Schema / shape assertions (R-B1, R-B2, R-B3)
-- -----------------------------------------------------------------------

select has_column('nodo_inmo', 'owner_settlements', 'breakdown',
  'owner_settlements.breakdown column exists');
select col_type_is('nodo_inmo', 'owner_settlements', 'breakdown', 'jsonb',
  'owner_settlements.breakdown is jsonb');
select col_is_null('nodo_inmo', 'owner_settlements', 'breakdown',
  'owner_settlements.breakdown is nullable');

select has_column('nodo_inmo', 'owner_settlements', 'settlement_group',
  'owner_settlements.settlement_group column exists');
select col_type_is('nodo_inmo', 'owner_settlements', 'settlement_group', 'uuid',
  'owner_settlements.settlement_group is uuid');

select has_column('nodo_inmo', 'property_expenses', 'applied_settlement_id',
  'property_expenses.applied_settlement_id column exists');
select col_type_is('nodo_inmo', 'property_expenses', 'applied_settlement_id', 'uuid',
  'property_expenses.applied_settlement_id is uuid');
select col_is_null('nodo_inmo', 'property_expenses', 'applied_settlement_id',
  'property_expenses.applied_settlement_id is nullable');

select col_is_fk('nodo_inmo', 'property_expenses', 'applied_settlement_id',
  'property_expenses.applied_settlement_id is a FK');

select has_index('nodo_inmo', 'property_expenses', 'property_expenses_unapplied_idx',
  'property_expenses_unapplied_idx partial index exists');

select has_index('nodo_inmo', 'owner_settlements', 'owner_settlements_group_idx',
  'owner_settlements_group_idx index exists');

-- -----------------------------------------------------------------------
-- B. Commission property-first rule (updated trigger)
-- -----------------------------------------------------------------------

-- d1/d2: property b1 has commission_rate = 10% → commission = 250000 * 10% = 25000
select is(
  (select amount from nodo_inmo.cash_movements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1' and source = 'commission'),
  25000.00,
  'trigger: property commission_rate (10%) used when property has its own rate');

-- d3: property b2 NULL commission_rate → fallback to contact 8% → 100000 * 8% = 8000
select is(
  (select amount from nodo_inmo.cash_movements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d3' and source = 'commission'),
  8000.00,
  'trigger: contact commission_rate (8%) used when property rate is NULL (fallback)');

-- WARNING-2: property commission_rate is NULL, contact commission_rate is 0 (zero-rate proxy).
-- Tests: coalesce(NULL, coalesce(0.00, 0)) = 0 → posted commission = 0 (documented behavior).
-- d6: property b3 NULL rate + contact a3 rate=0.00 → 80000 * 0% = 0
select is(
  (select amount from nodo_inmo.cash_movements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d6' and source = 'commission'),
  0.00,
  'trigger (WARNING-2): property-NULL + contact-0 commission_rate → posted commission = 0');

-- d6 owner_settlement amount should equal full payment (80000 - 0 = 80000)
select is(
  (select amount from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d6'),
  80000.00,
  'trigger (WARNING-2): zero effective commission → owner_settlement.amount = full payment amount');

-- -----------------------------------------------------------------------
-- C. Golden case — atomic seal (as admin of org G)
-- -----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"b0000000-0000-0000-0000-000000000001","role":"admin"}}';

-- Golden-case helper: seal d1 + d2 and store result
-- We use a helper function to capture the JSONB without temp table role issues.
do $$
declare
  v_sid1  uuid;
  v_sid2  uuid;
  v_ids   uuid[];
  v_bd    jsonb;
begin
  select id into v_sid1 from nodo_inmo.owner_settlements
    where payment_id = 'b0000000-0000-0000-0000-0000000000d1';
  select id into v_sid2 from nodo_inmo.owner_settlements
    where payment_id = 'b0000000-0000-0000-0000-0000000000d2';
  v_ids := array[v_sid1, v_sid2];

  select nodo_inmo.settle_owner(
    'b0000000-0000-0000-0000-0000000000a1'::uuid,
    'ARS',
    v_ids
  ) into v_bd;

  -- Write to a table visible to postgres role too (not temp, use nodo_inmo schema
  -- but we can't do DDL mid-test easily; instead write to a known scratch spot).
  -- Strategy: assert inline using the returned jsonb in this same DO block.
  -- We record pass/fail through pg_temp if needed, but for simplicity we use
  -- separate SELECT assertions directly against the persisted rows below.
  perform 1;  -- seal happened; assertions follow against the DB rows.
end $$;

-- After the golden seal the rows are updated; assert as postgres (superuser).
set local role postgres;

-- Both rows settled with breakdown
select is(
  (select count(*)::int from nodo_inmo.owner_settlements
   where payment_id in ('b0000000-0000-0000-0000-0000000000d1','b0000000-0000-0000-0000-0000000000d2')
     and status = 'settled'
     and breakdown is not null),
  2,
  'golden: both settlement rows are settled with non-null breakdown');

-- Shared settlement_group
select is(
  (select count(distinct settlement_group)::int from nodo_inmo.owner_settlements
   where payment_id in ('b0000000-0000-0000-0000-0000000000d1','b0000000-0000-0000-0000-0000000000d2')),
  1,
  'golden: both settlement rows share the same settlement_group UUID');

-- Gross = 2 × 250000 = 500000
select is(
  (select (breakdown->>'gross')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  500000.00,
  'golden: gross = sum of payment amounts (2 × 250000)');

-- Commission = 2 × 25000 = 50000
select is(
  (select (breakdown->>'commission')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  50000.00,
  'golden: commission = sum of commission cash_movements (2 × 25000)');

-- owner_share = 500000 - 50000 = 450000
select is(
  (select (breakdown->>'owner_share')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  450000.00,
  'golden: owner_share = gross - commission (450000)');

-- deduction_total = 12000 (one ARS chargeable expense)
select is(
  (select (breakdown->>'deduction_total')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  12000.00,
  'golden: deduction_total = ARS chargeable expense (12000)');

-- net = 450000 - 12000 = 438000
select is(
  (select (breakdown->>'net')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  438000.00,
  'golden: net = owner_share - deduction_total (438000)');

-- net identity: net = gross - commission - deduction_total
select is(
  (select (breakdown->>'net')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  (select (breakdown->>'gross')::numeric
          - (breakdown->>'commission')::numeric
          - (breakdown->>'deduction_total')::numeric
   from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  'golden: net identity holds (gross - commission - deduction_total)');

-- Exactly 1 deduction (only ARS expense)
select is(
  (select jsonb_array_length(breakdown->'deductions') from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  1,
  'golden: deductions has exactly 1 element (only ARS chargeable expense)');

-- ARS expense stamped
select is(
  (select applied_settlement_id is not null from nodo_inmo.property_expenses
   where id = 'b0000000-0000-0000-0000-0000000000e1'),
  true,
  'golden: ARS expense stamped with applied_settlement_id after seal');

-- USD expense not stamped (currency boundary)
select is(
  (select applied_settlement_id is null from nodo_inmo.property_expenses
   where id = 'b0000000-0000-0000-0000-0000000000e2'),
  true,
  'golden: USD expense not stamped by ARS seal (currency boundary)');

-- false-flagged expense not stamped
select is(
  (select applied_settlement_id is null from nodo_inmo.property_expenses
   where id = 'b0000000-0000-0000-0000-0000000000e3'),
  true,
  'golden: charged_to_owner=false expense never stamped');

-- CRITICAL-1 regression guard: deduction element must use key 'id', not 'expense_id'.
-- This assertion directly catches the key-name drift described in CRITICAL-1.
select is(
  (select breakdown->'deductions'->0->>'id' from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  'b0000000-0000-0000-0000-0000000000e1'::text,
  'golden (CRITICAL-1): deduction element key is ''id'' and contains the correct expense UUID');

select is(
  (select (breakdown->'deductions'->0->>'amount')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  12000.00,
  'golden (CRITICAL-1): deduction element ''amount'' has correct value');

-- CRITICAL-2 regression guard: the set of stamped expense IDs must exactly equal
-- the set of IDs captured in breakdown->deductions (no phantom stamps).
select is(
  (select array_agg(e.id order by e.id)
   from nodo_inmo.property_expenses e
   where e.applied_settlement_id = (
     select id from nodo_inmo.owner_settlements
     where payment_id = 'b0000000-0000-0000-0000-0000000000d1'
   )),
  (select array_agg((elem->>'id')::uuid order by (elem->>'id')::uuid)
   from nodo_inmo.owner_settlements os,
        jsonb_array_elements(os.breakdown->'deductions') elem
   where os.payment_id = 'b0000000-0000-0000-0000-0000000000d1'),
  'golden (CRITICAL-2): stamped expense set equals breakdown deductions set (no phantom stamps)');

-- -----------------------------------------------------------------------
-- D. No-double-count on second seal (headline correctness gate)
-- -----------------------------------------------------------------------

-- Seed a new payment + let trigger create new pending settlement
insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('b0000000-0000-0000-0000-0000000000d4', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000c1', '2026-03-01', '2026-03-10', 250000);

update nodo_inmo.payments set status = 'paid', paid_date = '2026-03-08'
  where id = 'b0000000-0000-0000-0000-0000000000d4';

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"b0000000-0000-0000-0000-000000000001","role":"admin"}}';

do $$
declare
  v_sid uuid;
begin
  select id into v_sid from nodo_inmo.owner_settlements
    where payment_id = 'b0000000-0000-0000-0000-0000000000d4';
  perform nodo_inmo.settle_owner(
    'b0000000-0000-0000-0000-0000000000a1'::uuid,
    'ARS',
    array[v_sid]
  );
end $$;

set local role postgres;

-- Second seal: deductions must be empty (ARS expense already consumed)
select is(
  (select jsonb_array_length(breakdown->'deductions') from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d4'),
  0,
  'no-double-count: second seal has 0 deductions (ARS expense already consumed)');

select is(
  (select (breakdown->>'deduction_total')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d4'),
  0.00,
  'no-double-count: second seal deduction_total = 0');

-- -----------------------------------------------------------------------
-- E. Seal-once guard (ADR-7)
-- -----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"b0000000-0000-0000-0000-000000000001","role":"admin"}}';

select throws_ok(
  $q$
  select nodo_inmo.settle_owner(
    'b0000000-0000-0000-0000-0000000000a1'::uuid,
    'ARS',
    (select array_agg(id) from nodo_inmo.owner_settlements
     where payment_id in ('b0000000-0000-0000-0000-0000000000d1','b0000000-0000-0000-0000-0000000000d2'))
  )
  $q$,
  null, null,
  'seal-once: re-sealing already-sealed rows raises exception');

-- -----------------------------------------------------------------------
-- F. Rollback on mid-seal failure (atomicity proof)
-- -----------------------------------------------------------------------

set local role postgres;

insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('b0000000-0000-0000-0000-0000000000d5', 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-0000000000c1', '2026-04-01', '2026-04-10', 250000);

update nodo_inmo.payments set status = 'paid', paid_date = '2026-04-08'
  where id = 'b0000000-0000-0000-0000-0000000000d5';

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"b0000000-0000-0000-0000-000000000001","role":"admin"}}';

-- Mix valid pending id + non-existent id → function must fail
select throws_ok(
  $q$
  select nodo_inmo.settle_owner(
    'b0000000-0000-0000-0000-0000000000a1'::uuid,
    'ARS',
    array[
      (select id from nodo_inmo.owner_settlements
       where payment_id = 'b0000000-0000-0000-0000-0000000000d5'),
      '00000000-0000-0000-0000-000000000000'::uuid
    ]
  )
  $q$,
  null, null,
  'atomicity: mixing valid + non-existent ids raises exception (transaction rolls back)');

set local role postgres;

-- After exception: settlement must still be pending with no breakdown
select is(
  (select status from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d5'),
  'pending',
  'atomicity: settlement still pending after failed seal (transaction rolled back)');

select is(
  (select breakdown is null from nodo_inmo.owner_settlements
   where payment_id = 'b0000000-0000-0000-0000-0000000000d5'),
  true,
  'atomicity: breakdown still null after failed seal');

-- -----------------------------------------------------------------------
-- G. Authorization
-- -----------------------------------------------------------------------

-- Agent blocked
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"b0000000-0000-0000-0000-000000000001","role":"agent"}}';

select throws_ok(
  $q$
  select nodo_inmo.settle_owner(
    'b0000000-0000-0000-0000-0000000000a1'::uuid,
    'ARS',
    (select array_agg(id) from nodo_inmo.owner_settlements
     where payment_id in ('b0000000-0000-0000-0000-0000000000d1','b0000000-0000-0000-0000-0000000000d2'))
  )
  $q$,
  null, null,
  'auth: agent JWT → settle_owner raises exception (role check fails)');

-- Wrong-org admin blocked
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-000000000003","app_metadata":{"org_id":"b0000000-0000-0000-0000-000000000002","role":"admin"}}';

select throws_ok(
  $q$
  select nodo_inmo.settle_owner(
    'b0000000-0000-0000-0000-0000000000a1'::uuid,
    'ARS',
    (select array_agg(id) from nodo_inmo.owner_settlements
     where payment_id in ('b0000000-0000-0000-0000-0000000000d1','b0000000-0000-0000-0000-0000000000d2'))
  )
  $q$,
  null, null,
  'auth: wrong-org admin JWT → settle_owner raises exception (org mismatch)');

select * from finish();
rollback;
