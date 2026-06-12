-- Conceptos de caja + cuentas de la inmobiliaria (fuente única para cobros y movimientos)
--
-- Antes las cuentas vivían en localStorage y las "cuentas bancarias" del panel
-- eran un estado local separado (duplicación). cash_accounts centraliza todo.
--
-- Template B (admin-only), igual que cash_movements.

-- ---------------------------------------------------------------------------
-- 1. conceptos — catálogo de conceptos para movimientos manuales
-- ---------------------------------------------------------------------------
create table nodo_inmo.conceptos (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null
                         references shared.organizations(id)
                         on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  constraint conceptos_org_name_unique unique (org_id, name)
);

create index conceptos_org_id_idx on nodo_inmo.conceptos (org_id);
create index conceptos_name_idx   on nodo_inmo.conceptos (org_id, name);

-- ---------------------------------------------------------------------------
-- 2. cash_accounts — cuentas de caja / banco de la inmobiliaria
-- ---------------------------------------------------------------------------
create table nodo_inmo.cash_accounts (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null
                         references shared.organizations(id)
                         on delete cascade,
  label      text        not null,
  currency   text        not null default 'ARS'
                         check (currency in ('ARS', 'USD')),
  kind       text        not null default 'EFECTIVO'
                         check (kind in ('BANCO', 'EFECTIVO')),
  bank_name  text,
  alias      text,
  cbu        text,
  sort_order int         not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint cash_accounts_org_label_unique unique (org_id, label)
);

create index cash_accounts_org_id_idx on nodo_inmo.cash_accounts (org_id);

create trigger set_updated_at
  before update on nodo_inmo.cash_accounts
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. cash_movements — vínculos opcionales a concepto y cuentas
-- ---------------------------------------------------------------------------
alter table nodo_inmo.cash_movements
  add column if not exists concepto_id uuid
    references nodo_inmo.conceptos(id) on delete set null,
  add column if not exists cash_account_id uuid
    references nodo_inmo.cash_accounts(id) on delete set null,
  add column if not exists destination_account_id uuid
    references nodo_inmo.cash_accounts(id) on delete set null,
  add column if not exists destination_category text;

create index cash_movements_concepto_idx on nodo_inmo.cash_movements (concepto_id);
create index cash_movements_account_idx  on nodo_inmo.cash_movements (cash_account_id);

-- ---------------------------------------------------------------------------
-- 4. RLS — Template B (admin-only)
-- ---------------------------------------------------------------------------
alter table nodo_inmo.conceptos    enable row level security;
alter table nodo_inmo.cash_accounts enable row level security;

-- conceptos
create policy "admin_select" on nodo_inmo.conceptos
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.conceptos
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.conceptos
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.conceptos
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- cash_accounts
create policy "admin_select" on nodo_inmo.cash_accounts
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.cash_accounts
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.cash_accounts
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.cash_accounts
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
