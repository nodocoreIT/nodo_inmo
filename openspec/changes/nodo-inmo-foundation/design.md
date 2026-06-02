# Design: nodo-inmo-foundation

Technical design for the database foundation. This is the source of truth for the
`apply` phase. SQL here is written to run against the shared Supabase project via the
Supabase MCP (`execute_sql` for iteration, then committed as a migration).

## 1. Schemas

```sql
create schema if not exists shared;
create schema if not exists nodo_inmo;
```

- `shared` — ecosystem-level, may be referenced by future Nodo products.
- `nodo_inmo` — nodo-inmo product domain. Created here; business tables come in later changes.
- `public` is left untouched (owned by nodo-core).

## 2. Data API exposure + grants

Non-`public` schemas are invisible to the Data API until exposed AND granted.

**Dashboard step (manual, must be verified):** Settings → API → Exposed schemas →
add `shared` and `nodo_inmo`. The Supabase MCP cannot toggle this setting; it is a project
config change the user performs. Apply must surface this as an explicit checklist item.

**SQL grants:**

```sql
grant usage on schema shared to authenticated, anon;
grant usage on schema nodo_inmo to authenticated;

-- Table privileges are granted per-table after creation (see each table below).
-- Default privileges so future tables inherit grants:
alter default privileges in schema nodo_inmo
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema shared
  grant select on tables to authenticated;
```

`anon` gets `usage` on `shared` only for the narrow public surface (e.g. a future
public listing); it receives no table grants here.

## 3. `shared` tables

### 3.1 organizations (tenant anchor)

```sql
create table shared.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  tier        text not null default 'starter'
              check (tier in ('starter', 'pro')),
  product     text not null default 'inmo',  -- which Nodo product created the org
  created_at  timestamptz not null default now()
);
alter table shared.organizations enable row level security;
```

### 3.2 org_members (source of truth for user↔org↔role)

```sql
create table shared.org_members (
  org_id      uuid not null references shared.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null
              check (role in ('admin', 'agent', 'owner', 'tenant')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table shared.org_members enable row level security;
create index org_members_user_idx on shared.org_members (user_id);
```

### 3.3 user_profiles (cross-nodo identity / display)

```sql
create table shared.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);
alter table shared.user_profiles enable row level security;
```

### 3.4 indices (IPC/ICL reference data)

```sql
create table shared.indices (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('IPC', 'ICL')),
  period      date not null,             -- first day of the month it applies to
  value       numeric(15, 6) not null,
  source      text not null default 'INDEC',
  created_at  timestamptz not null default now(),
  unique (kind, period)
);
alter table shared.indices enable row level security;
```

Reference data: readable by any authenticated user, writable only by service role
(Edge Function ingestion / manual admin fallback).

### 3.5 nodo_id (Pro / Phase 2 placeholder)

```sql
create table shared.nodo_id (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references shared.organizations(id) on delete cascade,
  product     text not null,
  created_at  timestamptz not null default now(),
  unique (org_id, product)
);
alter table shared.nodo_id enable row level security;
```

Structure only this change; federation logic is deferred.

## 4. RLS policies (foundation tables)

Claims come from `app_metadata` only. `org_id` of the current user is read from the
JWT and reused across policies.

```sql
-- organizations: a user sees only their own org
create policy "org_read_own" on shared.organizations
  for select to authenticated
  using ( id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );

-- org_members: members of an org can read membership of that same org
create policy "members_read_same_org" on shared.org_members
  for select to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );

-- only admins of the org can manage membership
create policy "members_admin_write" on shared.org_members
  for all to authenticated
  using (
    org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- user_profiles: a user manages only their own profile
create policy "profile_own" on shared.user_profiles
  for all to authenticated
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

-- indices: all authenticated read; writes only via service role (no policy for write)
create policy "indices_read_all" on shared.indices
  for select to authenticated
  using ( true );

-- nodo_id: read within own org
create policy "nodo_id_read_own" on shared.nodo_id
  for select to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );
```

Note: `org_members` deliberately uses JWT `role` (not a self-join on the table) to
decide admin rights. This avoids RLS recursion on the same table. The first admin of a
new org is created server-side (service role, bypasses RLS) during onboarding.

## 5. `nodo_inmo` table convention (template for later changes)

Every `nodo_inmo` business table MUST:

1. Include `org_id uuid not null references shared.organizations(id) on delete cascade`.
2. `enable row level security`.
3. Apply the four-policy template (SELECT/INSERT/UPDATE/DELETE) scoped by JWT `org_id`.
4. Add `org_id` to a composite or leading index where the table is queried by tenant.

Canonical template (copy per table):

```sql
alter table nodo_inmo.<t> enable row level security;

create policy "org_select" on nodo_inmo.<t> for select to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );
create policy "org_insert" on nodo_inmo.<t> for insert to authenticated
  with check ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );
create policy "org_update" on nodo_inmo.<t> for update to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid )
  with check ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );
create policy "org_delete" on nodo_inmo.<t> for delete to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );
```

## 5b. Role-based access (fixed roles: admin / agent)

Internal staff have two fixed roles. `admin` (the agency owner) sees everything;
`agent` (employees) sees an operational subset. Sensitive modules (cash/`caja`,
bank accounts, financial reports) are **admin-only** and MUST enforce this at the RLS
layer — hiding the menu in the UI is convenience, not security.

There are therefore **two RLS templates** for `nodo_inmo` tables:

**Template A — staff-shared (operational tables: properties, contracts, owners, …):**
visible to any internal staff of the org (`admin` or `agent`). This is the org-scoped
template in section 5.

**Template B — admin-only (sensitive tables: cash movements, bank accounts, financial
reports):** org-scoped AND `role = 'admin'`.

```sql
alter table nodo_inmo.<t> enable row level security;

create policy "admin_select" on nodo_inmo.<t> for select to authenticated
  using (
    org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "admin_insert" on nodo_inmo.<t> for insert to authenticated
  with check (
    org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "admin_update" on nodo_inmo.<t> for update to authenticated
  using (
    org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "admin_delete" on nodo_inmo.<t> for delete to authenticated
  using (
    org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

### Module → role matrix (the convention later changes follow)

| Module (future change)        | admin | agent | Template |
|-------------------------------|:-----:|:-----:|----------|
| Properties                    |  ✅   |  ✅   | A        |
| Owners / Tenants              |  ✅   |  ✅   | A        |
| Contracts                     |  ✅   |  ✅   | A        |
| Rent collection (payments)    |  ✅   |  ✅   | A        |
| **Cash / Caja movements**     |  ✅   |  ❌   | B        |
| **Bank accounts**             |  ✅   |  ❌   | B        |
| **Financial reports**         |  ✅   |  ❌   | B        |

This matrix is the agreed default; individual module changes may refine it but MUST
pick Template A or B explicitly and enforce it in RLS. The UI mirrors the matrix
(hide what the role can't use) on top of — never instead of — the RLS gate.

## 6. JWT app_metadata sync

`org_members` is the source of truth; the JWT mirrors `(org_id, role)` into
`app_metadata` so RLS reads them cheaply.

### 6.1 Trigger → Edge Function

```sql
create or replace function shared.sync_member_claims()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- Calls a trusted Edge Function that uses the Admin API to patch app_metadata
  -- for NEW.user_id with NEW.org_id and NEW.role.
  perform net.http_post(
    url     := <edge_function_url>,
    headers := jsonb_build_object('Authorization', 'Bearer ' || <service_token>),
    body    := jsonb_build_object('user_id', new.user_id,
                                  'org_id',  new.org_id,
                                  'role',    new.role)
  );
  return new;
end;
$$;

create trigger sync_member_claims_aiu
  after insert or update of role, org_id on shared.org_members
  for each row execute function shared.sync_member_claims();
```

### 6.2 Edge Function `sync-member-claims`

- Receives `{ user_id, org_id, role }`.
- Verifies the caller is the trusted trigger (shared secret / service token).
- Calls `supabase.auth.admin.updateUserById(user_id, { app_metadata: { org_id, role } })`.
- Idempotent; logs failures for manual re-sync.

### 6.3 Staleness convention

Client MUST call `supabase.auth.refreshSession()` after any operation that changes a
user's role/org/tier, so the new claims land in the active JWT. Documented as a
project convention; covered by a test in a later change.

### 6.4 Fallback

If trigger-sync proves brittle, replace JWT lookups with a `SECURITY DEFINER` helper
`shared.current_org_id()` reading `org_members` by `auth.uid()`, wrapped in `(select …)`.
Not used initially.

## 7. Security checklist (run before committing the migration)

- [ ] RLS enabled on every table in `shared` and `nodo_inmo`.
- [ ] No policy reads `user_metadata` for authorization.
- [ ] Every UPDATE/ALL policy has both `USING` and `WITH CHECK`.
- [ ] `security definer` functions set `search_path = ''` and live with explicit grants.
- [ ] `shared` and `nodo_inmo` added to Data API exposed schemas (dashboard) — verified.
- [ ] `supabase db advisors` / MCP `get_advisors` run clean.
- [ ] Cross-tenant test: a member of org A querying returns 0 rows from org B.

## 8. Migration commit flow

1. Iterate schema with MCP `execute_sql` (no migration history churn).
2. Run advisors; fix findings.
3. `supabase db pull nodo_inmo_foundation --local --yes` to generate the migration.
4. `supabase migration list --local` to verify.

## Open questions for spec

- Exact onboarding path that creates the first `admin` + `organization` (service-role
  flow) — specified at the requirement level in spec.md, implemented in a later change.
- Whether `anon` needs any `shared` table read in Phase 1 (currently: no).
