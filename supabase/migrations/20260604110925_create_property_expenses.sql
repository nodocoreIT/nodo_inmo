-- nodo_inmo.property_expenses — Gasto de propiedad (leg 1 of rendiciones roadmap)
--
-- ADMIN-ONLY (Template B RLS): org-scoped AND role = 'admin'. Agents are blocked.
-- This is the dedicated business table for property expenses. It is intentionally
-- isolated from nodo_inmo.cash_movements (ADR-1): owner-charged expenses are
-- settlement deductions, not agency-ledger entries.
--
-- Receipt photos land in the private Storage bucket `property-expense-receipts`.
-- Access is gated by org-scoped storage.objects policies (§6).
--
-- The deduction query contract is exposed via the security_invoker view
-- nodo_inmo.owner_chargeable_expenses (§7 / ADR-6).
--
-- updated_at: reuses nodo_inmo.set_updated_at() from the properties migration.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table nodo_inmo.property_expenses (
  id               uuid          primary key default gen_random_uuid(),
  org_id           uuid          not null
                                 references shared.organizations(id)
                                 on delete cascade,
  property_id      uuid          not null
                                 references nodo_inmo.properties(id)
                                 on delete restrict,
  type             text          not null
                                 check (type in ('arreglo', 'compra_accesorio')),
  amount           numeric(15,2) not null
                                 check (amount > 0),
  currency         text          not null default 'ARS'
                                 check (currency in ('ARS', 'USD')),
  expense_date     date          not null default current_date,
  description      text          not null,
  receipt_path     text,                          -- storage object key; nullable (optional photo)
  charged_to_owner boolean       not null,        -- load-bearing; NO default (ADR-4)
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
create index property_expenses_org_id_idx      on nodo_inmo.property_expenses (org_id);
create index property_expenses_property_id_idx on nodo_inmo.property_expenses (property_id);

-- Partial index for the settlement consumption query: scans only chargeable rows
-- ordered by date. Keeps the index small (only the rows the rendicion cares about).
create index property_expenses_chargeable_idx
  on nodo_inmo.property_expenses (org_id, expense_date)
  where charged_to_owner = true;

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger — reuses nodo_inmo.set_updated_at() from properties migration
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_inmo.property_expenses
  for each row
  execute function nodo_inmo.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template B (admin-only), mirrored from create_caja.sql
--    org-scoped AND app_metadata.role = 'admin'. Agents are blocked entirely.
--    InitPlan-friendly form wraps auth.jwt() in a sub-select so the JWT is
--    fetched once per statement, not once per row.
--    UPDATE has both USING and WITH CHECK so org_id cannot be reassigned.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.property_expenses enable row level security;

create policy "admin_select" on nodo_inmo.property_expenses
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.property_expenses
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.property_expenses
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.property_expenses
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
-- 5. Storage — private bucket `property-expense-receipts`
--    public = false is non-negotiable (receipts contain tax IDs / facturas).
--    10 MiB cap per file. MIME types: JPEG, PNG, WebP, PDF.
--    on conflict do nothing — idempotent for re-runs / db reset.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-expense-receipts',
  'property-expense-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. storage.objects policies — INSERT + SELECT + UPDATE + DELETE (admin-only, org-scoped)
--    INSERT + SELECT + UPDATE are ALL required for upsert; INSERT-only makes
--    file replacement silently fail (Supabase security checklist warning).
--    DELETE lets an admin remove a wrong upload.
--    (storage.foldername(name))[1] returns the leading path segment = org_id.
--    Compared as text (no ::uuid cast avoids errors on malformed segments).
-- ---------------------------------------------------------------------------
create policy "receipts_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "receipts_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "receipts_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "receipts_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 7. Settlement consumption seam — owner_chargeable_expenses view (ADR-6)
--    security_invoker = true: the view runs with the caller's privileges so
--    the Template B RLS on property_expenses still applies. Without it, the
--    view would bypass RLS and leak cross-tenant rows (the Supabase view trap).
--    Rows where p.owner_id is null naturally fall out of the inner join.
-- ---------------------------------------------------------------------------
create view nodo_inmo.owner_chargeable_expenses
  with (security_invoker = true) as
select
  e.id            as expense_id,
  e.org_id,
  p.owner_id,
  e.property_id,
  e.amount,
  e.currency,
  e.expense_date,
  e.type,
  e.description
from nodo_inmo.property_expenses e
join nodo_inmo.properties p on p.id = e.property_id
where e.charged_to_owner = true;
