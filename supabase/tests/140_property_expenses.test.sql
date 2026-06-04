-- Test: nodo_inmo.property_expenses — Gasto de propiedad
--
-- ADMIN-ONLY (Template B): org-scoped AND role = 'admin'. Agents are blocked.
-- Storage bucket: property-expense-receipts (private, org-scoped policies).
-- View: owner_chargeable_expenses (security_invoker = true).
--
-- TDD: RED first (table/objects do not exist), GREEN after migration.
-- Follows the style of 120_caja.test.sql.
begin;
select plan(40);

-- -----------------------------------------------------------------------
-- Seed: two orgs, admin + agent for org E, properties with an owner
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('f1000000-0000-0000-0000-000000000001', 'admin-e@test.local', 'x', now(), now()),
  ('f2000000-0000-0000-0000-000000000002', 'agent-e@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('f0000000-0000-0000-0000-000000000001', 'Org E', 'starter'),
  ('f0000000-0000-0000-0000-000000000002', 'Org F', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'admin'),
  ('f0000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'agent');

insert into nodo_inmo.contacts (id, org_id, name, roles) values
  ('e0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-000000000001', 'Owner E', array['owner']::text[]);

insert into nodo_inmo.properties (id, org_id, owner_id, address, operation, property_type, status, currency) values
  ('e0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', 'San Martin 200', 'rent', 'apartment', 'available', 'ARS'),
  ('e0000000-0000-0000-0000-0000000000b2', 'f0000000-0000-0000-0000-000000000002', null, 'Org F Prop', 'rent', 'house', 'available', 'ARS');

-- -----------------------------------------------------------------------
-- A. Table existence and shape (R1–R7)
-- -----------------------------------------------------------------------

-- R1: table exists
select has_table('nodo_inmo', 'property_expenses', 'property_expenses table exists');

-- R2: primary key
select col_is_pk('nodo_inmo', 'property_expenses', 'id', 'property_expenses.id is the PK');

-- R2: NOT NULL columns
select col_not_null('nodo_inmo', 'property_expenses', 'org_id',           'property_expenses.org_id NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'property_id',      'property_expenses.property_id NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'type',             'property_expenses.type NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'amount',           'property_expenses.amount NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'currency',         'property_expenses.currency NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'expense_date',     'property_expenses.expense_date NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'description',      'property_expenses.description NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'charged_to_owner', 'property_expenses.charged_to_owner NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'created_at',       'property_expenses.created_at NOT NULL');
select col_not_null('nodo_inmo', 'property_expenses', 'updated_at',       'property_expenses.updated_at NOT NULL');

-- R2: receipt_path is nullable
select col_is_null('nodo_inmo', 'property_expenses', 'receipt_path', 'property_expenses.receipt_path is nullable');

-- R2: FK on property_id
select col_is_fk('nodo_inmo', 'property_expenses', 'property_id', 'property_expenses.property_id is a FK');

-- R3: charged_to_owner has NO column-level default (ADR-4)
select col_hasnt_default('nodo_inmo', 'property_expenses', 'charged_to_owner', 'property_expenses.charged_to_owner has no default (ADR-4)');

-- R3: runtime enforcement — INSERT omitting charged_to_owner is rejected (NOT NULL violation)
select throws_ok(
  $q$ insert into nodo_inmo.property_expenses
        (org_id, property_id, type, amount, currency, expense_date, description)
      values
        ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',100,'ARS','2026-06-01','Missing charged_to_owner') $q$,
  '23502', null, 'R3: INSERT omitting charged_to_owner rejected (NOT NULL violation)');

-- R4: amount > 0 — zero rejected
select throws_ok(
  $q$ insert into nodo_inmo.property_expenses
        (org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
      values
        ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',0,'ARS','2026-06-01','Zero amount',true) $q$,
  null, null, 'property_expenses.amount check: zero rejected');

-- R4: amount > 0 — negative rejected
select throws_ok(
  $q$ insert into nodo_inmo.property_expenses
        (org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
      values
        ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',-1,'ARS','2026-06-01','Negative amount',true) $q$,
  null, null, 'property_expenses.amount check: negative rejected');

-- R5: invalid type rejected
select throws_ok(
  $q$ insert into nodo_inmo.property_expenses
        (org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
      values
        ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','otro',100,'ARS','2026-06-01','Bad type',true) $q$,
  null, null, 'property_expenses.type check: invalid value rejected');

-- R6: invalid currency rejected
select throws_ok(
  $q$ insert into nodo_inmo.property_expenses
        (org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
      values
        ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',100,'EUR','2026-06-01','Bad currency',true) $q$,
  null, null, 'property_expenses.currency check: EUR rejected');

-- R7: valid insert succeeds (as postgres / superuser — before RLS tests)
select lives_ok(
  $q$ insert into nodo_inmo.property_expenses
        (id, org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
      values
        ('e0000000-0000-0000-0000-0000000000c1','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',150.00,'ARS','2026-06-01','Fix plomeria',true) $q$,
  'valid property_expense insert succeeds');

-- R7: updated_at advances on UPDATE (trigger fires)
do $$
declare t1 timestamptz; t2 timestamptz;
begin
  select updated_at into t1 from nodo_inmo.property_expenses where id = 'e0000000-0000-0000-0000-0000000000c1';
  perform pg_sleep(0.02);
  update nodo_inmo.property_expenses set description = 'Fix plomeria (edit)' where id = 'e0000000-0000-0000-0000-0000000000c1';
  select updated_at into t2 from nodo_inmo.property_expenses where id = 'e0000000-0000-0000-0000-0000000000c1';
  if t2 <= t1 then raise exception 'updated_at did not advance'; end if;
end $$;
select ok(true, 'property_expenses.updated_at advances on UPDATE (trigger fires)');

-- -----------------------------------------------------------------------
-- B. RLS — Template B (admin-only) (R8–R14)
-- -----------------------------------------------------------------------

-- R8: RLS enabled
select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'nodo_inmo' and c.relname = 'property_expenses'),
  true, 'property_expenses: RLS is enabled');

-- Seed an org F expense as superuser (bypasses RLS) for cross-org isolation tests
insert into nodo_inmo.property_expenses
  (id, org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
values
  ('e0000000-0000-0000-0000-0000000000d1','f0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-0000000000b2','compra_accesorio',200.00,'USD','2026-06-01','Org F expense',false);

set local role authenticated;

-- R11: agent JWT → SELECT returns 0 rows
set local request.jwt.claims = '{"sub":"f2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.property_expenses where org_id = 'f0000000-0000-0000-0000-000000000001'),
  0, 'TemplateB: agent sees 0 property_expenses (admin-only)');

-- R11: agent INSERT is rejected
select throws_ok(
  $q$ insert into nodo_inmo.property_expenses
        (org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
      values
        ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',50,'ARS','2026-06-01','Agent attempt',false) $q$,
  null, null, 'TemplateB: agent INSERT into property_expenses blocked');

-- R9: admin JWT → SELECT returns seeded row
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.property_expenses where org_id = 'f0000000-0000-0000-0000-000000000001'),
  '>', 0, 'TemplateB: admin sees own-org property_expenses');

-- R10: admin INSERT succeeds
select lives_ok(
  $q$ insert into nodo_inmo.property_expenses
        (org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
      values
        ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','compra_accesorio',75.50,'ARS','2026-06-02','Admin insert',false) $q$,
  'TemplateB: admin can INSERT property_expenses');

-- R12: admin org E scoped → org F row invisible
select is(
  (select count(*)::int from nodo_inmo.property_expenses where org_id = 'f0000000-0000-0000-0000-000000000002'),
  0, 'TemplateB: org E admin cannot see org F property_expenses (cross-org blocked)');

-- R13: UPDATE cannot reassign org_id (WITH CHECK)
-- Uses Org F ('f0000000-0000-0000-0000-000000000002'), which is a VALID org seeded above,
-- so the FK on shared.organizations is satisfied. Only the RLS WITH CHECK predicate
-- (org_id must match JWT org_id) can block this update — proving the guard is real.
-- If the policy lacked WITH CHECK, this update would silently reassign the row to Org F.
select throws_ok(
  $q$ update nodo_inmo.property_expenses
        set org_id = 'f0000000-0000-0000-0000-000000000002'
      where id = 'e0000000-0000-0000-0000-0000000000c1' $q$,
  null, null, 'RLS: UPDATE cannot reassign org_id to valid other org (WITH CHECK)');

-- R14: anon role → SELECT is blocked (permission denied — stricter than 0 rows;
-- anon has no USAGE on nodo_inmo schema by design, so access errors before RLS)
set local role anon;

select throws_ok(
  $q$ select count(*) from nodo_inmo.property_expenses $q$,
  null, null, 'TemplateB: anon SELECT on property_expenses is blocked');

-- Reset to postgres for remaining privileged operations
set local role postgres;

-- -----------------------------------------------------------------------
-- C. Storage — private bucket (R15) + policy existence
-- -----------------------------------------------------------------------

-- R15: bucket exists and is private
select is(
  (select public from storage.buckets where id = 'property-expense-receipts'),
  false, 'storage: property-expense-receipts bucket is private (public = false)');

-- Storage policies exist on storage.objects — assert each receipts_admin_* policy individually.
-- Using ok(exists(...)) instead of policies_are(...) so that adding future bucket policies
-- (e.g. for contract documents) does not cause a false failure here.
select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'receipts_admin_select'),
  'storage policy receipts_admin_select exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'receipts_admin_insert'),
  'storage policy receipts_admin_insert exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'receipts_admin_update'),
  'storage policy receipts_admin_update exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'receipts_admin_delete'),
  'storage policy receipts_admin_delete exists');

-- -----------------------------------------------------------------------
-- D. Ledger isolation (R26) — inserting expenses does NOT touch cash_movements
-- -----------------------------------------------------------------------

do $$
declare n_before int; n_after int;
begin
  select count(*)::int into n_before from nodo_inmo.cash_movements
  where org_id = 'f0000000-0000-0000-0000-000000000001';

  insert into nodo_inmo.property_expenses
    (org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
  values
    ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',500,'ARS','2026-06-03','Ledger check charged',true),
    ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',300,'ARS','2026-06-03','Ledger check not charged',false);

  select count(*)::int into n_after from nodo_inmo.cash_movements
  where org_id = 'f0000000-0000-0000-0000-000000000001';

  if n_after != n_before then
    raise exception 'cash_movements count changed: before=% after=%', n_before, n_after;
  end if;
end $$;
select ok(true, 'R26: inserting property_expenses does not touch cash_movements');

-- -----------------------------------------------------------------------
-- E. Deduction view — owner_chargeable_expenses (R27/R28)
-- -----------------------------------------------------------------------

-- R27: view exists
select has_view('nodo_inmo', 'owner_chargeable_expenses', 'owner_chargeable_expenses view exists');

-- Insert view test rows as superuser for reliable seeding
insert into nodo_inmo.property_expenses
  (id, org_id, property_id, type, amount, currency, expense_date, description, charged_to_owner)
values
  ('e0000000-0000-0000-0000-0000000000e1','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',100,'ARS','2026-06-04','View test charged',true),
  ('e0000000-0000-0000-0000-0000000000e2','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000b1','arreglo',100,'ARS','2026-06-04','View test not charged',false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}';

-- R27/R28: admin sees the charged_to_owner = true row with correct owner_id
select is(
  (select owner_id from nodo_inmo.owner_chargeable_expenses
   where expense_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'e0000000-0000-0000-0000-0000000000a1'::uuid,
  'R27: owner_chargeable_expenses returns correct owner_id via property join');

-- R27: the false row is NOT in the view
select is(
  (select count(*)::int from nodo_inmo.owner_chargeable_expenses
   where expense_id = 'e0000000-0000-0000-0000-0000000000e2'),
  0, 'R27: charged_to_owner = false rows excluded from owner_chargeable_expenses');

-- R28: agent sees 0 rows in the view (security_invoker preserves Template B)
set local request.jwt.claims = '{"sub":"f2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.owner_chargeable_expenses),
  0, 'R28: agent sees 0 rows in owner_chargeable_expenses (security_invoker preserves TemplateB)');

select * from finish();
rollback;
