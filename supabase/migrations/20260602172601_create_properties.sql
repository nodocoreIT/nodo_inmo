-- nodo_inmo.properties — first business table
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
-- updated_at trigger: custom set_updated_at() function, SECURITY DEFINER +
-- search_path=''. moddatetime extension is available but NOT enabled in this
-- project; the custom function avoids the extra extension dependency.

-- ---------------------------------------------------------------------------
-- 1. updated_at trigger function
--    SECURITY DEFINER so it can fire without relying on invoker privileges.
--    Empty search_path prevents search-path injection.
--    Idempotent: OR REPLACE.
-- ---------------------------------------------------------------------------
create or replace function nodo_inmo.set_updated_at()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- clock_timestamp() returns real wall time, unlike now() which is frozen
  -- to the transaction start. This ensures updated_at always advances on UPDATE
  -- even within the same transaction.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Table definition
-- ---------------------------------------------------------------------------
create table nodo_inmo.properties (
  id                    uuid          primary key default gen_random_uuid(),
  org_id                uuid          not null
                                      references shared.organizations(id)
                                      on delete cascade,
  owner_id              uuid,         -- nullable; FK added when owners module ships
  address               text          not null,
  operation             text          not null
                                      check (operation in ('rent', 'sale')),
  property_type         text          not null
                                      check (property_type in
                                        ('apartment', 'house', 'commercial', 'land', 'other')),
  status                text          not null default 'available'
                                      check (status in
                                        ('available', 'reserved', 'rented', 'sold', 'inactive')),
  sale_price            numeric(15,2),
  currency              text          not null default 'ARS'
                                      check (currency in ('ARS', 'USD')),
  total_sqm             numeric(10,2),
  rooms                 integer       default 1,
  main_photo            text,
  description           text,
  inventory_description text,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 3. Leading index on org_id (tenant query path)
-- ---------------------------------------------------------------------------
create index properties_org_id_idx on nodo_inmo.properties (org_id);

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_inmo.properties
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS — Template A (staff-shared)
--    Four explicit policies (SELECT / INSERT / UPDATE / DELETE).
--    No role gate: both admin and agent of the org can operate on properties.
--    UPDATE carries USING + WITH CHECK so org_id cannot be reassigned.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.properties enable row level security;

create policy "org_select" on nodo_inmo.properties
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_insert" on nodo_inmo.properties
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.properties
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.properties
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- Note on grants: the foundation migration already applied
--   alter default privileges in schema nodo_inmo
--     grant select, insert, update, delete on tables to authenticated;
-- so this table is automatically reachable by the authenticated role.
-- No additional GRANT needed.
-- ---------------------------------------------------------------------------
