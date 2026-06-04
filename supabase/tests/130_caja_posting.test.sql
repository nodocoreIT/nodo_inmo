-- Test: post_payment_to_caja trigger — cobro splits into commission + settlement
--
-- TDD: RED before the trigger migration, GREEN after.
begin;
select plan(8);

insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('e1000000-0000-0000-0000-000000000001', 'admin-p@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('e0000000-0000-0000-0000-000000000001', 'Org P', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'admin');

-- Owner with 10% commission, tenant, property (with owner), contract, payment.
insert into nodo_inmo.contacts (id, org_id, name, roles, commission_rate) values
  ('c0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'Owner P',  array['owner']::text[], 10.00),
  ('c0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000001', 'Tenant P', array['tenant']::text[], 0);

insert into nodo_inmo.properties (id, org_id, owner_id, address, operation, property_type, status, currency) values
  ('d0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', 'Roca 100', 'rent', 'apartment', 'available', 'ARS'),
  ('d0000000-0000-0000-0000-0000000000a2', 'e0000000-0000-0000-0000-000000000001', null,                                   'Sin Dueño 1', 'rent', 'house', 'available', 'ARS');

insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount) values
  ('a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000b1', '2026-01-01', '2027-01-01', 250000),
  ('a0000000-0000-0000-0000-0000000000a2', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-0000000000b1', '2026-01-01', '2027-01-01', 100000);

insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('a0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', '2026-01-01', '2026-01-10', 250000),
  ('a0000000-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a2', '2026-01-01', '2026-01-10', 100000);

-- Before: no caja activity
select is((select count(*)::int from nodo_inmo.cash_movements), 0, 'no cash_movements before any cobro');
select is((select count(*)::int from nodo_inmo.owner_settlements), 0, 'no settlements before any cobro');

-- Mark the owned-property cobro as paid → trigger fires
update nodo_inmo.payments set status = 'paid', paid_date = '2026-01-08'
where id = 'a0000000-0000-0000-0000-0000000000b1';

-- Commission income = 10% of 250000 = 25000
select is(
  (select amount from nodo_inmo.cash_movements where payment_id = 'a0000000-0000-0000-0000-0000000000b1' and source = 'commission'),
  25000.00, 'commission income posted to caja (10% of 250000)');

-- Owner settlement = 225000, pending
select is(
  (select amount from nodo_inmo.owner_settlements where payment_id = 'a0000000-0000-0000-0000-0000000000b1'),
  225000.00, 'owner settlement created for the remainder (225000)');
select is(
  (select status from nodo_inmo.owner_settlements where payment_id = 'a0000000-0000-0000-0000-0000000000b1'),
  'pending', 'owner settlement starts pending');

-- Idempotency: a no-op update (still paid) does not double-post
update nodo_inmo.payments set notes = 'touch' where id = 'a0000000-0000-0000-0000-0000000000b1';
select is(
  (select count(*)::int from nodo_inmo.cash_movements where payment_id = 'a0000000-0000-0000-0000-0000000000b1'),
  1, 'idempotent: re-saving a paid cobro does not duplicate the caja movement');

-- No-owner property: whole amount is agency income, no settlement
update nodo_inmo.payments set status = 'paid', paid_date = '2026-01-08'
where id = 'a0000000-0000-0000-0000-0000000000b2';
select is(
  (select amount from nodo_inmo.cash_movements where payment_id = 'a0000000-0000-0000-0000-0000000000b2'),
  100000.00, 'no-owner cobro: full amount posted as agency income');
select is(
  (select count(*)::int from nodo_inmo.owner_settlements where payment_id = 'a0000000-0000-0000-0000-0000000000b2'),
  0, 'no-owner cobro: no settlement created');

select * from finish();
rollback;
