-- nodo_inmo.cash_movements + nodo_inmo.owner_settlements — Caja + liquidaciones
--
-- Caja is ADMIN-ONLY (Template B RLS): org-scoped AND role = 'admin'. Agents are
-- blocked entirely. This is the agency's money ledger and owner-settlement state.
--
-- Flow (wired in later slices): when a rent installment is marked paid, the
-- amount splits into the agency commission (income → cash_movements) and the
-- owner's share (owner_settlements, pending). Settling an owner pays them out
-- (expense → cash_movements) and marks their pending settlements as settled.
--
-- Balance is derived: sum(income) - sum(expense). Nothing stored.
--
-- updated_at: reuses nodo_inmo.set_updated_at() from the properties migration.

-- ---------------------------------------------------------------------------
-- 1. owner_settlements — what the agency owes each owner, per cobro
-- ---------------------------------------------------------------------------
create table nodo_inmo.owner_settlements (
  id            uuid          primary key default gen_random_uuid(),
  org_id        uuid          not null
                              references shared.organizations(id)
                              on delete cascade,
  owner_id      uuid          not null
                              references nodo_inmo.contacts(id)
                              on delete restrict,
  payment_id    uuid          not null
                              references nodo_inmo.payments(id)
                              on delete cascade,
  amount        numeric(15,2) not null,
  currency      text          not null default 'ARS'
                              check (currency in ('ARS', 'USD')),
  status        text          not null default 'pending'
                              check (status in ('pending', 'settled')),
  settled_date  date,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default clock_timestamp(),
  constraint owner_settlements_payment_unique unique (payment_id)
);

create index owner_settlements_org_id_idx   on nodo_inmo.owner_settlements (org_id);
create index owner_settlements_owner_id_idx on nodo_inmo.owner_settlements (owner_id);
create index owner_settlements_status_idx   on nodo_inmo.owner_settlements (status);

create trigger set_updated_at
  before update on nodo_inmo.owner_settlements
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. cash_movements — the agency's money ledger
-- ---------------------------------------------------------------------------
create table nodo_inmo.cash_movements (
  id          uuid          primary key default gen_random_uuid(),
  org_id      uuid          not null
                            references shared.organizations(id)
                            on delete cascade,
  type        text          not null check (type in ('income', 'expense')),
  amount      numeric(15,2) not null check (amount >= 0),
  currency    text          not null default 'ARS'
                            check (currency in ('ARS', 'USD')),
  date        date          not null default current_date,
  concept     text          not null,
  category    text,
  source      text          not null default 'manual'
                            check (source in ('manual', 'commission', 'owner_payout')),
  -- Optional links: commission income → the cobro; owner payout → the owner.
  payment_id  uuid          references nodo_inmo.payments(id) on delete set null,
  owner_id    uuid          references nodo_inmo.contacts(id) on delete set null,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default clock_timestamp()
);

create index cash_movements_org_id_idx  on nodo_inmo.cash_movements (org_id);
create index cash_movements_date_idx    on nodo_inmo.cash_movements (date);
create index cash_movements_payment_idx on nodo_inmo.cash_movements (payment_id);

create trigger set_updated_at
  before update on nodo_inmo.cash_movements
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — Template B (admin-only) on both tables
--    org-scoped AND app_metadata.role = 'admin'. Agents are blocked.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.owner_settlements enable row level security;
alter table nodo_inmo.cash_movements    enable row level security;

-- owner_settlements
create policy "admin_select" on nodo_inmo.owner_settlements
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.owner_settlements
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.owner_settlements
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.owner_settlements
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- cash_movements
create policy "admin_select" on nodo_inmo.cash_movements
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.cash_movements
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.cash_movements
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.cash_movements
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- ---------------------------------------------------------------------------
-- Note: default privileges grant from the foundation migration already makes
-- both tables reachable by the authenticated role (RLS still gates to admin).
-- ---------------------------------------------------------------------------
