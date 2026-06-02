# Proposal: nodo-inmo-foundation

## Intent

Establish the database foundation for nodo-inmo: the multi-tenant boundary, the
identity/role primitives, and the conventions every future business table will
inherit. This change does **not** model business entities (properties, contracts,
payments…). It builds the floor those modules stand on, so that tenant isolation,
role-based access, and Supabase wiring are correct from the first table — not
retrofitted later (which would mean rewriting every policy).

## Why now

- nodo-inmo is a **multi-tenant SaaS**: many agencies share one Supabase project,
  and each agency must see only its own data. Tenant isolation is not a feature you
  add later — it is a property of every table from day one.
- The tenant (`organization`) and shared reference data (IPC/ICL indices) belong to
  the **Nodo ecosystem**, not to inmo alone. Modeling them in a shared schema now
  avoids locking ecosystem concepts inside a single product.
- The source Django system was single-agency. The tenant entity, `org_id`, and RLS
  are net-new and have no prior art to copy — they must be designed deliberately.

## Scope

### In scope

1. **Two Postgres schemas** in the existing shared Supabase project:
   - `shared` — ecosystem-level: `organizations` (tenant anchor), `org_members`
     (user↔org membership + role), `user_profiles`, `indices` (IPC/ICL reference),
     and a `nodo_id` placeholder table (Pro / Phase 2, structure only).
   - `nodo_inmo` — product schema. This change creates the schema and its grants/exposure
     but leaves business tables to later changes.
2. **Tenant isolation convention**: every `nodo_inmo` business table will carry
   `org_id uuid NOT NULL REFERENCES shared.organizations(id)`, with RLS enabled.
3. **Role model** (4 roles, stored in `shared.org_members` as source of truth):
   - `admin` — full CRUD within own org (internal staff)
   - `agent` — properties/contracts CRUD, configurable financial read (internal staff)
   - `owner` — read own properties + payment history (agency's **client**, portal)
   - `tenant` — read own contract + payments, create claims (agency's **client**, Pro)
4. **RLS delivery via JWT**: policies read `org_id` and `role` from
   `auth.jwt() -> 'app_metadata'`. A trigger on `org_members` keeps `app_metadata`
   in sync via a trusted Edge Function (Supabase Admin API).
5. **Reusable RLS policy template** that all `nodo_inmo` tables will follow (all four
   command types, `USING` + `WITH CHECK` where required).
6. **Supabase Data API wiring**: expose `shared` and `nodo_inmo` schemas and grant
   `USAGE` to `authenticated` (and `anon` only where genuinely needed).

### Out of scope (later changes)

- Business tables: properties, owners, tenants, contracts, payments, cash, expenses,
  sales pipeline, construction.
- IPC/ICL calculation engine and INDEC ingestion Edge Functions.
- Storage buckets, Realtime subscriptions, frontend scaffolding.
- Nodo ID federation logic (table placeholder only).

## Approach

### Two-layer isolation (the core idea)

These are **two different boundaries** and both must hold:

- **Schema** (`shared` vs `nodo_inmo`) isolates the **product** within the shared Supabase
  project. It separates inmo from nodo-core (which lives in `public`) and from future
  products. It is namespacing, not security.
- **`org_id` + RLS** isolates the **tenant**. This is the real multi-tenant security
  boundary: agency A can never read agency B's rows.

Confusing these is the classic mistake. The schema does not protect tenants from each
other — only RLS does.

### Role and JWT sync

`shared.org_members` is the source of truth for `(user, org, role)`. Because RLS runs
per-row in Postgres, resolving the user's org via a subquery on every check is the
slow path. Instead, `org_id` and `role` are mirrored into the user's JWT
`app_metadata`, and policies read them directly from the token. A trigger on
`org_members` UPDATE invokes a trusted Edge Function that patches `app_metadata` via
the Admin API.

Trade-off accepted: JWT claims are **stale until the next token refresh**. After any
role/tier/org change the app must call `supabase.auth.refreshSession()`. This is a
documented convention, not an afterthought. If the trigger-sync proves brittle, the
fallback is a `SECURITY DEFINER` helper (`current_org_id()`) wrapped in `(select …)`
for planner caching.

### RLS policy template (inherited by every nodo_inmo table)

```sql
-- SELECT
create policy "org_select" on nodo_inmo.<table>
  for select to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );

-- INSERT
create policy "org_insert" on nodo_inmo.<table>
  for insert to authenticated
  with check ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );

-- UPDATE (needs both USING and WITH CHECK)
create policy "org_update" on nodo_inmo.<table>
  for update to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid )
  with check ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );

-- DELETE
create policy "org_delete" on nodo_inmo.<table>
  for delete to authenticated
  using ( org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid );
```

Security rules baked into the convention:
- Authorization claims come from `app_metadata` only — never `user_metadata`
  (user-editable).
- Every table in an exposed schema has RLS **enabled**.
- UPDATE always pairs `USING` with `WITH CHECK` so a row's `org_id` cannot be
  reassigned to another tenant.
- Views use `security_invoker = true` (Postgres 15+).

### Supabase wiring

`shared` and `nodo_inmo` are non-`public` schemas, so they are **not exposed to the Data
API by default**. The change must add both to the exposed-schemas list and run
`GRANT USAGE ON SCHEMA … TO authenticated` (plus table-level grants), or the JS client
sees zero tables. This is the single easiest step to forget.

## Risks

1. **RLS gaps = silent cross-tenant leak.** The whole product's security rests on
   this convention. Every table created later must apply all four policies; this needs
   a verification checklist before any launch.
2. **JWT staleness.** Role/tier/org changes don't take effect until session refresh.
   Must be enforced as an app convention and tested.
3. **Non-public schema exposure missed.** Easy to forget; produces a confusing
   "no tables visible" failure. Make it an explicit, verified step.
4. **Trigger → Edge Function sync fragility.** If `app_metadata` sync fails silently,
   a user could be left with stale or missing claims. Needs error surfacing and a
   manual re-sync path.
5. **Shared schema coupling with nodo-core.** `shared.organizations` may eventually be
   touched by other Nodo products. This change owns it for now; cross-product
   ownership needs a later convention.

## Success looks like

- `shared` and `nodo_inmo` schemas exist, are exposed to the Data API, and granted.
- `organizations`, `org_members`, `user_profiles`, `indices`, `nodo_id` exist with RLS
  enabled and policies that scope by org membership.
- A documented, copy-pasteable RLS template that every future `nodo_inmo` table follows.
- JWT `app_metadata` sync works: changing a user's role updates their claims after
  refresh, and RLS honors it.
- A new agency can be created and its members can read only their own org's data —
  proven by a cross-tenant test query that returns zero rows.

## Next recommended

`spec` + `design` for nodo-inmo-foundation — turn this into concrete requirements
(spec) and the exact schema/trigger/Edge-Function design before tasks and apply.
Apply will require the Supabase MCP to be connected (reload + OAuth).
