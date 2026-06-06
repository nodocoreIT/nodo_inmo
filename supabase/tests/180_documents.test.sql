-- Test: nodo_inmo.documents — General document storage
--
-- ADMIN-ONLY (Template B): org-scoped AND role = 'admin'. Agents are blocked.
-- Storage bucket: org-documents (private, org-scoped policies).
--
-- TDD: RED first (table/objects do not exist), GREEN after migration.
-- Follows the style of 140_property_expenses.test.sql.
begin;
select plan(35);

-- -----------------------------------------------------------------------
-- Seed: two orgs, admin + agent for org G, a property and a contract
-- -----------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('a1000000-0000-0000-0000-000000000001', 'admin-g@test.local', 'x', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', 'agent-g@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('a0000000-0000-0000-0000-000000000001', 'Org G', 'starter'),
  ('a0000000-0000-0000-0000-000000000002', 'Org H', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'agent');

insert into nodo_inmo.contacts (id, org_id, name, roles) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'Owner G', array['owner']::text[]),
  ('a0000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000001', 'Tenant G', array['tenant']::text[]);

insert into nodo_inmo.properties (id, org_id, owner_id, address, operation, property_type, status, currency) values
  ('a0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'Belgrano 100', 'rent', 'apartment', 'available', 'ARS'),
  ('a0000000-0000-0000-0000-0000000000b2', 'a0000000-0000-0000-0000-000000000002', null, 'Org H Prop', 'rent', 'house', 'available', 'ARS');

insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount, currency, adjustment_index, adjustment_period_months, next_adjustment_date, deposit_amount, expenses_paid_by, commission_amount, status) values
  ('a0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000a2', '2026-01-01', '2029-01-01', 200000, 'ARS', 'ICL', 3, '2026-04-01', 200000, 'tenant', 20000, 'active');

-- -----------------------------------------------------------------------
-- A. Table existence and shape
-- -----------------------------------------------------------------------

-- table exists
select has_table('nodo_inmo', 'documents', 'documents table exists');

-- primary key
select col_is_pk('nodo_inmo', 'documents', 'id', 'documents.id is the PK');

-- required columns present
select has_column('nodo_inmo', 'documents', 'id',            'has id');
select has_column('nodo_inmo', 'documents', 'org_id',        'has org_id');
select has_column('nodo_inmo', 'documents', 'property_id',   'has property_id');
select has_column('nodo_inmo', 'documents', 'contract_id',   'has contract_id');
select has_column('nodo_inmo', 'documents', 'label',         'has label');
select has_column('nodo_inmo', 'documents', 'document_type', 'has document_type');
select has_column('nodo_inmo', 'documents', 'file_path',     'has file_path');
select has_column('nodo_inmo', 'documents', 'notes',         'has notes');
select has_column('nodo_inmo', 'documents', 'uploaded_at',   'has uploaded_at');
select has_column('nodo_inmo', 'documents', 'updated_at',    'has updated_at');

-- NOT NULL columns
select col_not_null('nodo_inmo', 'documents', 'org_id',       'documents.org_id NOT NULL');
select col_not_null('nodo_inmo', 'documents', 'label',        'documents.label NOT NULL');
select col_not_null('nodo_inmo', 'documents', 'document_type','documents.document_type NOT NULL');
select col_not_null('nodo_inmo', 'documents', 'file_path',    'documents.file_path NOT NULL');
select col_not_null('nodo_inmo', 'documents', 'uploaded_at',  'documents.uploaded_at NOT NULL');

-- nullable optional columns
select col_is_null('nodo_inmo', 'documents', 'property_id', 'documents.property_id is nullable');
select col_is_null('nodo_inmo', 'documents', 'contract_id', 'documents.contract_id is nullable');
select col_is_null('nodo_inmo', 'documents', 'notes',       'documents.notes is nullable');

-- document_type check constraint: invalid value rejected
select throws_ok(
  $q$ insert into nodo_inmo.documents (org_id, label, document_type, file_path)
      values ('a0000000-0000-0000-0000-000000000001', 'x', 'invalid_type', 'org/path') $q$,
  null, null, 'document_type check constraint rejects invalid value');

-- document_type check constraint: valid value accepted
select lives_ok(
  $q$ insert into nodo_inmo.documents (id, org_id, label, document_type, file_path)
      values ('a0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-000000000001', 'Factura test', 'factura', 'org/uuid-factura.pdf') $q$,
  'document_type = factura accepted');

-- -----------------------------------------------------------------------
-- B. RLS — Template B (admin-only)
-- -----------------------------------------------------------------------

-- RLS enabled
select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'nodo_inmo' and c.relname = 'documents'),
  true, 'documents: RLS is enabled');

-- 4 table-level policies exist
select is(
  (select count(*)::int from pg_policies where schemaname = 'nodo_inmo' and tablename = 'documents'),
  4, '4 RLS policies on documents');

-- Seed a cross-org doc as superuser
insert into nodo_inmo.documents (id, org_id, label, document_type, file_path)
values ('a0000000-0000-0000-0000-0000000000d2', 'a0000000-0000-0000-0000-000000000002', 'Org H doc', 'otro', 'orgh/uuid-doc.pdf');

set local role authenticated;

-- agent JWT → SELECT returns 0 rows
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000002","app_metadata":{"org_id":"a0000000-0000-0000-0000-000000000001","role":"agent"}}';

select is(
  (select count(*)::int from nodo_inmo.documents where org_id = 'a0000000-0000-0000-0000-000000000001'),
  0, 'TemplateB: agent sees 0 documents (admin-only)');

-- agent INSERT is rejected
select throws_ok(
  $q$ insert into nodo_inmo.documents (org_id, label, document_type, file_path)
      values ('a0000000-0000-0000-0000-000000000001', 'Agent attempt', 'otro', 'path/doc.pdf') $q$,
  null, null, 'TemplateB: agent INSERT into documents blocked');

-- admin JWT → SELECT returns own-org row
set local request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","app_metadata":{"org_id":"a0000000-0000-0000-0000-000000000001","role":"admin"}}';

select cmp_ok(
  (select count(*)::int from nodo_inmo.documents where org_id = 'a0000000-0000-0000-0000-000000000001'),
  '>', 0, 'TemplateB: admin sees own-org documents');

-- admin INSERT succeeds
select lives_ok(
  $q$ insert into nodo_inmo.documents (org_id, label, document_type, file_path)
      values ('a0000000-0000-0000-0000-000000000001', 'Admin insert', 'presupuesto', 'org/uuid-presup.pdf') $q$,
  'TemplateB: admin can INSERT documents');

-- admin org G scoped → org H row invisible
select is(
  (select count(*)::int from nodo_inmo.documents where org_id = 'a0000000-0000-0000-0000-000000000002'),
  0, 'TemplateB: org G admin cannot see org H documents (cross-org blocked)');

-- UPDATE cannot reassign org_id (WITH CHECK)
select throws_ok(
  $q$ update nodo_inmo.documents
        set org_id = 'a0000000-0000-0000-0000-000000000002'
      where id = 'a0000000-0000-0000-0000-0000000000d1' $q$,
  null, null, 'RLS: UPDATE cannot reassign org_id (WITH CHECK)');

-- Reset to postgres for remaining privileged operations
set local role postgres;

-- -----------------------------------------------------------------------
-- C. Storage — private bucket + policy existence
-- -----------------------------------------------------------------------

-- bucket exists and is private
select is(
  (select public from storage.buckets where id = 'org-documents'),
  false, 'storage: org-documents bucket is private (public = false)');

-- assert each documents_admin_* policy individually
select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'documents_admin_select'),
  'storage policy documents_admin_select exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'documents_admin_insert'),
  'storage policy documents_admin_insert exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'documents_admin_update'),
  'storage policy documents_admin_update exists');

select ok(
  exists(select 1 from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'documents_admin_delete'),
  'storage policy documents_admin_delete exists');

select * from finish();
rollback;
