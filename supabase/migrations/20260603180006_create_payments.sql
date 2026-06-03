-- nodo_inmo.payments — rent installments (cuotas)
--
-- One row per contract per period (month). Installments are auto-generated from
-- the contract (start_date → end_date) at the contract's rent_amount, then staff
-- mark each as paid. "Overdue" is NOT stored: it is derived (status = 'pending'
-- AND due_date < today) so no cron/job is needed to keep it current.
--
-- Tenant isolation: carries org_id, Template A (staff-shared) RLS. Cascades from
-- its contract (deleting a contract removes its installments).
--
-- updated_at: reuses nodo_inmo.set_updated_at() from the properties migration.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table nodo_inmo.payments (
  id             uuid          primary key default gen_random_uuid(),
  org_id         uuid          not null
                               references shared.organizations(id)
                               on delete cascade,
  contract_id    uuid          not null
                               references nodo_inmo.contracts(id)
                               on delete cascade,
  period         date          not null,          -- first day of the covered month
  due_date       date          not null,
  amount         numeric(15,2) not null,
  currency       text          not null default 'ARS'
                               check (currency in ('ARS', 'USD')),
  status         text          not null default 'pending'
                               check (status in ('pending', 'paid', 'cancelled')),
  paid_date      date,
  paid_amount    numeric(15,2),
  payment_method text          check (payment_method in
                                 ('cash', 'transfer', 'check', 'card', 'other')),
  notes          text,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default clock_timestamp(),
  constraint payments_contract_period_unique unique (contract_id, period)
);

create index payments_org_id_idx      on nodo_inmo.payments (org_id);
create index payments_contract_id_idx on nodo_inmo.payments (contract_id);
create index payments_due_date_idx    on nodo_inmo.payments (due_date);

create trigger set_updated_at
  before update on nodo_inmo.payments
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS — Template A (staff-shared)
-- ---------------------------------------------------------------------------
alter table nodo_inmo.payments enable row level security;

create policy "org_select" on nodo_inmo.payments
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_insert" on nodo_inmo.payments
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.payments
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.payments
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- Note: default privileges grant from the foundation migration already makes
-- this table reachable by the authenticated role.
-- ---------------------------------------------------------------------------
