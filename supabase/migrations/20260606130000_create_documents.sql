-- nodo_inmo.documents — General document storage for the agency
--
-- ADMIN-ONLY (Template B RLS): org-scoped AND role = 'admin'. Agents are blocked.
-- Stores facturas, presupuestos, certificates, and other agency documents.
-- Optionally linked to a property or contract (both FK nullable — ADR-D6).
--
-- Files land in the private Storage bucket `org-documents`.
-- Storage path: {org_id}/{uuid}-{sanitized_filename} (flat, no property_id segment —
-- documents may not be tied to a property).
--
-- updated_at: reuses nodo_inmo.set_updated_at() from the properties migration.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table nodo_inmo.documents (
  id             uuid        primary key default gen_random_uuid(),
  org_id         uuid        not null
                             references shared.organizations(id)
                             on delete cascade,
  property_id    uuid        references nodo_inmo.properties(id) on delete set null,
  contract_id    uuid        references nodo_inmo.contracts(id)  on delete set null,
  label          text        not null,
  document_type  text        not null default 'otro'
                             check (document_type in ('factura','presupuesto','certificado','otro')),
  file_path      text        not null,
  notes          text,
  uploaded_at    timestamptz not null default now(),
  updated_at     timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
create index documents_org_id_idx      on nodo_inmo.documents (org_id);
create index documents_property_id_idx on nodo_inmo.documents (property_id);
create index documents_contract_id_idx on nodo_inmo.documents (contract_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger — reuses nodo_inmo.set_updated_at() from properties migration
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_inmo.documents
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template B (admin-only), mirrored from property_expenses migration
--    org-scoped AND app_metadata.role = 'admin'. Agents are blocked entirely.
--    InitPlan-friendly form wraps auth.jwt() in a sub-select so the JWT is
--    fetched once per statement, not once per row.
--    UPDATE has both USING and WITH CHECK so org_id cannot be reassigned.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.documents enable row level security;

create policy "admin_select" on nodo_inmo.documents
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.documents
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.documents
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.documents
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- ---------------------------------------------------------------------------
-- Note: default privileges grant from the foundation migration already makes
-- this table reachable by the authenticated role (RLS still gates to admin).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Storage — private bucket `org-documents`
--    public = false (documents contain sensitive financial/legal content).
--    10 MiB cap per file. MIME types: JPEG, PNG, WebP, PDF.
--    on conflict do nothing — idempotent for re-runs / db reset.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-documents',
  'org-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. storage.objects policies — SELECT + INSERT + UPDATE + DELETE (admin-only, org-scoped)
--    All 4 required (Supabase security checklist).
--    (storage.foldername(name))[1] returns the leading path segment = org_id.
--    Compared as text (no ::uuid cast — avoids errors on malformed segments).
-- ---------------------------------------------------------------------------
create policy "documents_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "documents_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "documents_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "documents_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
