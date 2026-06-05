-- nodo_inmo.org_profiles — Agency profile (leg 2, PR-A of rendiciones roadmap)
--
-- ADMIN-ONLY (Template B RLS): org-scoped AND role = 'admin'. Agents are blocked.
-- One profile row per org: org_id is both PK and FK → shared.organizations (ADR-1).
-- All comprobante fields are nullable — graceful first-run (proposal risk 5).
--
-- Logo photos land in the private Storage bucket `org-branding`.
-- Access is gated by org-scoped storage.objects policies (§4).
--
-- updated_at: reuses nodo_inmo.set_updated_at() from the properties migration.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table nodo_inmo.org_profiles (
  org_id      uuid          primary key
                            references shared.organizations(id)
                            on delete cascade,
  legal_name  text,                 -- razón social on the comprobante (nullable: graceful first-run)
  address     text,                 -- domicilio
  cuit        text,                 -- fiscal id; format validated client-side, stored as text
  phone       text,
  email       text,
  logo_path   text,                 -- storage object key in `org-branding`; nullable
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger — reuses nodo_inmo.set_updated_at() from properties migration
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_inmo.org_profiles
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — Template B (admin-only), mirrored from create_property_expenses.sql
--    org-scoped AND app_metadata.role = 'admin'. Agents are blocked entirely.
--    InitPlan-friendly form wraps auth.jwt() in a sub-select so the JWT is
--    fetched once per statement, not once per row.
--    UPDATE has both USING and WITH CHECK so org_id cannot be reassigned.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.org_profiles enable row level security;

create policy "admin_select" on nodo_inmo.org_profiles
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.org_profiles
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.org_profiles
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.org_profiles
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
-- 4. Storage — private bucket `org-branding`
--    public = false. 2 MiB cap per logo.
--    MIME types: raster only (JPEG, PNG, WebP). SVG excluded — React-PDF
--    cannot render SVG, so allowing it produces a logo that uploads fine
--    but never renders on the comprobante (design §4.1).
--    on conflict do nothing — idempotent for re-runs / db reset.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-branding',
  'org-branding',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. storage.objects policies — INSERT + SELECT + UPDATE + DELETE (admin-only, org-scoped)
--    INSERT + SELECT + UPDATE are ALL required for upsert; INSERT-only makes
--    file replacement silently fail (Supabase security checklist warning).
--    DELETE lets an admin remove a wrong upload.
--    (storage.foldername(name))[1] returns the leading path segment = org_id.
--    Compared as text (no ::uuid cast avoids errors on malformed segments).
-- ---------------------------------------------------------------------------
create policy "branding_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "branding_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "branding_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "branding_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
