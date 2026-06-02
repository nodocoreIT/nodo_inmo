-- nodo_inmo.owners — propietarios business table
--
-- Template A (staff-shared): org-scoped SELECT/INSERT/UPDATE/DELETE for any
-- internal staff member (admin OR agent). No role gate — this is operational
-- data, not admin-only (Template B).
--
-- InitPlan-friendly RLS form:
--   org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
-- The sub-select wraps auth.jwt() so the JWT is fetched once per statement
-- (InitPlan), not once per row. This is the pattern every nodo_inmo business
-- table follows.
--
-- updated_at trigger: reuses nodo_inmo.set_updated_at() already created by
-- the properties migration. No need to recreate it.
--
-- Deferred FK: adds properties_owner_id_fkey to nodo_inmo.properties.
-- The owner_id column already exists as a nullable uuid; this migration
-- wires the FK constraint now that owners exists.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table nodo_inmo.owners (
  id                    uuid          primary key default gen_random_uuid(),
  org_id                uuid          not null
                                      references shared.organizations(id)
                                      on delete cascade,
  name                  text          not null,
  dni                   text,
  address               text,
  phone                 text,
  email                 text,
  commission_rate       numeric(5,2)  not null default 10.00,
  can_view_rentals      boolean       not null default false,
  can_view_construction boolean       not null default false,
  can_view_sales        boolean       not null default false,
  portal_user_id        uuid          references auth.users(id)
                                      on delete set null,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Leading index on org_id (tenant query path)
-- ---------------------------------------------------------------------------
create index owners_org_id_idx on nodo_inmo.owners (org_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger (reuses set_updated_at already defined on properties)
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_inmo.owners
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (staff-shared)
--    Four explicit policies (SELECT / INSERT / UPDATE / DELETE).
--    No role gate: both admin and agent of the org can operate on owners.
--    UPDATE carries USING + WITH CHECK so org_id cannot be reassigned.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.owners enable row level security;

create policy "org_select" on nodo_inmo.owners
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_insert" on nodo_inmo.owners
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.owners
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.owners
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- 5. Wire the deferred FK: properties.owner_id → nodo_inmo.owners
--    The column already exists (nullable uuid, no FK). This constraint was
--    intentionally deferred until the owners module shipped.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.properties
  add constraint properties_owner_id_fkey
  foreign key (owner_id)
  references nodo_inmo.owners(id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- Note on grants: the foundation migration already applied
--   alter default privileges in schema nodo_inmo
--     grant select, insert, update, delete on tables to authenticated;
-- so this table is automatically reachable by the authenticated role.
-- No additional GRANT needed.
-- ---------------------------------------------------------------------------
