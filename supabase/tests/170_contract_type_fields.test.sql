-- Test: nodo_inmo.contracts — Phase C new columns
--
-- Verifies that signing_date, signing_city, and contract_type were added by the
-- 20260606120000_add_contract_type_fields.sql migration with correct types,
-- nullability, defaults, and the check constraint.
begin;
select plan(9);

-- ── 1–3: Columns exist ────────────────────────────────────────────────────────
select has_column('nodo_inmo', 'contracts', 'signing_date',
  'contracts.signing_date column exists');

select has_column('nodo_inmo', 'contracts', 'signing_city',
  'contracts.signing_city column exists');

select has_column('nodo_inmo', 'contracts', 'contract_type',
  'contracts.contract_type column exists');

-- ── 4: contract_type is NOT NULL ──────────────────────────────────────────────
select col_not_null('nodo_inmo', 'contracts', 'contract_type',
  'contracts.contract_type is NOT NULL');

-- ── 5: contract_type default ──────────────────────────────────────────────────
select col_default_is('nodo_inmo', 'contracts', 'contract_type', 'habitacional',
  'contracts.contract_type defaults to habitacional');

-- ── 6: signing_city default ───────────────────────────────────────────────────
select col_default_is('nodo_inmo', 'contracts', 'signing_city',
  'Ciudad Autónoma de Buenos Aires',
  'contracts.signing_city defaults to Ciudad Autónoma de Buenos Aires');

-- ── 7: CHECK constraint rejects invalid contract_type ─────────────────────────
-- Seed minimal prerequisite rows so FK constraints do not fire
do $$
begin
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
    values ('a1700000-0000-0000-0000-000000000001', 'admin-170@test.local', 'x', now(), now())
    on conflict (id) do nothing;
  insert into shared.organizations (id, name, tier)
    values ('b1700000-0000-0000-0000-000000000001', 'Org 170', 'starter')
    on conflict (id) do nothing;
  insert into shared.org_members (org_id, user_id, role)
    values ('b1700000-0000-0000-0000-000000000001', 'a1700000-0000-0000-0000-000000000001', 'admin')
    on conflict do nothing;
  insert into nodo_inmo.contacts (id, org_id, name, roles)
    values ('c1700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001', 'Inquilino 170', array['tenant']::text[])
    on conflict (id) do nothing;
  insert into nodo_inmo.properties (id, org_id, address, operation, property_type, status, currency)
    values ('d1700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001', 'Test 170', 'rent', 'apartment', 'available', 'ARS')
    on conflict (id) do nothing;
end $$;

select throws_ok(
  $q$
    insert into nodo_inmo.contracts
      (org_id, property_id, tenant_id, start_date, end_date, rent_amount, contract_type)
    values
      ('b1700000-0000-0000-0000-000000000001',
       'd1700000-0000-0000-0000-000000000001',
       'c1700000-0000-0000-0000-000000000001',
       '2026-01-01', '2028-01-01', 100000, 'industrial')
  $q$,
  null, null,
  'contract_type check: industrial rejected');

-- ── 8: CHECK constraint allows comercial ──────────────────────────────────────
select lives_ok(
  $q$
    insert into nodo_inmo.contracts
      (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount, contract_type)
    values
      ('e1700000-0000-0000-0000-000000000001',
       'b1700000-0000-0000-0000-000000000001',
       'd1700000-0000-0000-0000-000000000001',
       'c1700000-0000-0000-0000-000000000001',
       '2026-01-01', '2028-01-01', 100000, 'comercial')
  $q$,
  'contract_type check: comercial accepted');

-- ── 9: Default backfill — new row gets habitacional + CABA ────────────────────
do $$
declare
  v_type text;
  v_city text;
begin
  insert into nodo_inmo.contracts
    (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount)
  values
    ('e1700000-0000-0000-0000-000000000002',
     'b1700000-0000-0000-0000-000000000001',
     'd1700000-0000-0000-0000-000000000001',
     'c1700000-0000-0000-0000-000000000001',
     '2026-02-01', '2028-02-01', 120000);

  select contract_type, signing_city
    into v_type, v_city
    from nodo_inmo.contracts
   where id = 'e1700000-0000-0000-0000-000000000002';

  if v_type <> 'habitacional' then
    raise exception 'Expected habitacional, got %', v_type;
  end if;
  if v_city <> 'Ciudad Autónoma de Buenos Aires' then
    raise exception 'Expected CABA, got %', v_city;
  end if;
end $$;

select ok(true, 'Default backfill: new row gets contract_type=habitacional and signing_city=CABA');

select * from finish();
rollback;
