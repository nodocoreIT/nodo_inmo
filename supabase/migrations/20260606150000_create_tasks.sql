-- database migration: create tasks table
--
-- Template A (staff-shared): org-scoped SELECT/INSERT/UPDATE/DELETE for any
-- internal staff member (admin OR agent). No role gate — this is operational
-- data, not admin-only (Template B).
--
-- updated_at: reuses nodo_inmo.set_updated_at() from properties migration.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table nodo_inmo.tasks (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null
                           references shared.organizations(id)
                           on delete cascade,
  title        text        not null,
  description  text,
  category     text        not null default 'general'
                           check (category in ('visita', 'firma', 'cobro', 'mantenimiento', 'tramite', 'general')),
  priority     text        not null default 'media'
                           check (priority in ('alta', 'media', 'baja')),
  status       text        not null default 'pendiente'
                           check (status in ('pendiente', 'en_progreso', 'completada', 'cancelada')),
  due_date     date        not null default current_date,
  assigned_to  text,       -- Name of the assigned staff member
  property_id  uuid        references nodo_inmo.properties(id) on delete set null,
  contact_id   uuid        references nodo_inmo.contacts(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
create index tasks_org_id_idx on nodo_inmo.tasks (org_id);
create index tasks_due_date_idx on nodo_inmo.tasks (org_id, due_date);
create index tasks_property_id_idx on nodo_inmo.tasks (property_id);
create index tasks_contact_id_idx on nodo_inmo.tasks (contact_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_inmo.tasks
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (staff-shared)
-- ---------------------------------------------------------------------------
alter table nodo_inmo.tasks enable row level security;

create policy "org_select" on nodo_inmo.tasks
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_insert" on nodo_inmo.tasks
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.tasks
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.tasks
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );
