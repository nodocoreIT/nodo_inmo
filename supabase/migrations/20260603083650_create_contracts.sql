-- nodo_inmo.contracts + nodo_inmo.contract_guarantors
--
-- A rental contract (locación) ties a property to a tenant (contact), with
-- rent/currency, deposit, commission, expenses responsibility, an adjustment
-- index (IPC/ICL/fixed/USD) + periodicity in months, and a status lifecycle
-- (draft → active → terminated/expired).
--
-- Guarantors (garantes) are modeled as a join table (contract ↔ contact),
-- NOT capped at two — Argentine contracts often carry one or two, sometimes
-- more. Each guarantor is a contacts row carrying the 'guarantor' role.
--
-- Tenant isolation: both tables carry org_id and follow Template A
-- (staff-shared) RLS — admin AND agent of the org operate freely; cross-tenant
-- access is blocked. InitPlan-friendly RLS form wraps auth.jwt() in a sub-select
-- so the JWT is read once per statement, not once per row.
--
-- Referential integrity:
--   property_id / tenant_id → ON DELETE RESTRICT (protect contract history;
--     a property or tenant tied to a contract cannot be deleted).
--   contract_guarantors.contract_id → ON DELETE CASCADE (links die with the
--     contract); guarantor_id → ON DELETE RESTRICT (protect the link).
--
-- updated_at: reuses nodo_inmo.set_updated_at() created by the properties
-- migration.

-- ---------------------------------------------------------------------------
-- 1. contracts table
-- ---------------------------------------------------------------------------
create table nodo_inmo.contracts (
  id                       uuid          primary key default gen_random_uuid(),
  org_id                   uuid          not null
                                         references shared.organizations(id)
                                         on delete cascade,
  property_id              uuid          not null
                                         references nodo_inmo.properties(id)
                                         on delete restrict,
  tenant_id                uuid          not null
                                         references nodo_inmo.contacts(id)
                                         on delete restrict,
  start_date               date          not null,
  end_date                 date          not null,
  rent_amount              numeric(15,2) not null,
  currency                 text          not null default 'ARS'
                                         check (currency in ('ARS', 'USD')),
  deposit_amount           numeric(15,2),
  commission_amount        numeric(15,2),
  expenses_paid_by         text          not null default 'tenant'
                                         check (expenses_paid_by in ('tenant', 'owner')),
  adjustment_index         text          not null default 'IPC'
                                         check (adjustment_index in ('IPC', 'ICL', 'fixed', 'USD')),
  adjustment_period_months integer       not null default 12
                                         check (adjustment_period_months > 0),
  next_adjustment_date     date,
  status                   text          not null default 'draft'
                                         check (status in ('draft', 'active', 'terminated', 'expired')),
  notes                    text,
  created_at               timestamptz   not null default now(),
  updated_at               timestamptz   not null default clock_timestamp(),
  constraint contracts_end_after_start check (end_date > start_date)
);

create index contracts_org_id_idx      on nodo_inmo.contracts (org_id);
create index contracts_property_id_idx on nodo_inmo.contracts (property_id);
create index contracts_tenant_id_idx   on nodo_inmo.contracts (tenant_id);

create trigger set_updated_at
  before update on nodo_inmo.contracts
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. contract_guarantors join table
-- ---------------------------------------------------------------------------
create table nodo_inmo.contract_guarantors (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null
                           references shared.organizations(id)
                           on delete cascade,
  contract_id  uuid        not null
                           references nodo_inmo.contracts(id)
                           on delete cascade,
  guarantor_id uuid        not null
                           references nodo_inmo.contacts(id)
                           on delete restrict,
  created_at   timestamptz not null default now(),
  constraint contract_guarantors_unique unique (contract_id, guarantor_id)
);

create index contract_guarantors_org_id_idx      on nodo_inmo.contract_guarantors (org_id);
create index contract_guarantors_contract_id_idx on nodo_inmo.contract_guarantors (contract_id);

-- ---------------------------------------------------------------------------
-- 3. RLS — Template A (staff-shared) on contracts
-- ---------------------------------------------------------------------------
alter table nodo_inmo.contracts enable row level security;

create policy "org_select" on nodo_inmo.contracts
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_insert" on nodo_inmo.contracts
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.contracts
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.contracts
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (staff-shared) on contract_guarantors
-- ---------------------------------------------------------------------------
alter table nodo_inmo.contract_guarantors enable row level security;

create policy "org_select" on nodo_inmo.contract_guarantors
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_insert" on nodo_inmo.contract_guarantors
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.contract_guarantors
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.contract_guarantors
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- Note on grants: the foundation migration already applied
--   alter default privileges in schema nodo_inmo
--     grant select, insert, update, delete on tables to authenticated;
-- so both tables are automatically reachable by the authenticated role.
-- ---------------------------------------------------------------------------
