# Spec: nodo-inmo-foundation

Requirements for the database foundation. Each requirement is verifiable. Scenarios
use Given/When/Then. "MUST" is normative.

## Capability: Schema separation

### R1 — Product and ecosystem schemas exist
The system MUST provide two Postgres schemas: `shared` (ecosystem-level) and `nodo_inmo`
(product), in the shared Supabase project, without modifying `public`.

- **Scenario: schemas present**
  - Given the foundation migration has been applied
  - When the database schemas are listed
  - Then `shared` and `nodo_inmo` both exist
  - And `public` retains nodo-core's existing tables unchanged

### R2 — Non-public schemas are reachable by the Data API
Both `shared` and `nodo_inmo` MUST be exposed to the Supabase Data API and granted so the
authenticated role can reach permitted tables.

- **Scenario: schema exposed and granted**
  - Given `shared` and `nodo_inmo` are added to the Data API exposed schemas
  - And `usage` is granted to `authenticated`
  - When an authenticated client queries an exposed table
  - Then the request reaches the table (subject to RLS), not a "schema not found" error

## Capability: Tenant model

### R3 — Organization is the tenant anchor
The system MUST represent each agency as one row in `shared.organizations`, carrying a
`tier` of `starter` or `pro`.

- **Scenario: create organization**
  - Given the foundation is applied
  - When an organization is inserted with a valid tier
  - Then it receives a uuid id and a `created_at`
  - And an invalid tier value is rejected by the check constraint

### R4 — Membership binds user, org, and role
A user's relationship to an org MUST live in `shared.org_members` as `(org_id, user_id,
role)`, with role in `admin | agent | owner | tenant`, and `(org_id, user_id)` unique.

- **Scenario: add member**
  - Given an existing organization
  - When a row is inserted into `org_members` with a valid role
  - Then the membership is stored
  - And inserting a second row with the same `(org_id, user_id)` is rejected
  - And an invalid role is rejected by the check constraint

### R5 — A user belongs to membership-defined orgs only
The data model MUST allow a user to be a member of an org via `org_members` and MUST
NOT grant any org access without a corresponding membership row.

## Capability: Tenant isolation (RLS)

### R6 — RLS enabled on all foundation tables
Every table in `shared` and `nodo_inmo` MUST have row level security enabled.

- **Scenario: RLS on**
  - Given the foundation is applied
  - When each table's `relrowsecurity` is checked
  - Then it is true for every table in `shared` and `nodo_inmo`

### R7 — Tenant cannot read another tenant's data
A user authenticated for org A MUST NOT be able to read rows belonging to org B.

- **Scenario: cross-tenant read blocked**
  - Given user U with `app_metadata.org_id = A`
  - And data rows exist for org A and org B
  - When U selects from an org-scoped table
  - Then only org A rows are returned, and zero org B rows

### R8 — Authorization claims come from app_metadata only
RLS policies MUST derive `org_id` and `role` from `auth.jwt() -> 'app_metadata'` and
MUST NOT use `user_metadata` for any authorization decision.

- **Scenario: user_metadata cannot escalate**
  - Given user U edits their own `user_metadata` to claim a different `org_id`
  - When U queries an org-scoped table
  - Then access is still scoped by `app_metadata`, not the edited `user_metadata`

### R9 — Writes cannot reassign a row's tenant
UPDATE policies on org-scoped tables MUST include both `USING` and `WITH CHECK` so a
row's `org_id` cannot be changed to another org.

- **Scenario: org reassignment blocked**
  - Given user U in org A owns a row in an org-scoped table
  - When U attempts to update that row's `org_id` to org B
  - Then the update is rejected by the policy's `WITH CHECK`

### R10 — Membership management restricted to admins
Only a user whose claim `role = admin` for the org MUST be able to insert/update/delete
`org_members` rows of that org.

- **Scenario: non-admin cannot manage members**
  - Given user U with `role = agent` in org A
  - When U attempts to insert an `org_members` row for org A
  - Then the operation is rejected

### R11 — Profiles are self-scoped
A user MUST be able to read and write only their own `shared.user_profiles` row.

### R12 — Reference indices readable by all tenants, writable by none via API
`shared.indices` MUST be selectable by any authenticated user and MUST NOT be writable
through the Data API by `authenticated` (writes only via service role).

- **Scenario: index read/write**
  - Given index rows exist
  - When any authenticated user selects from `shared.indices`
  - Then rows are returned
  - And an insert/update attempt by `authenticated` is rejected

## Capability: Claim synchronization

### R13 — Membership changes propagate to JWT claims
When an `org_members` row's `role` or `org_id` changes, the affected user's
`app_metadata` MUST be updated to mirror `(org_id, role)`.

- **Scenario: role change syncs**
  - Given user U with `role = agent`
  - When U's membership role is changed to `admin`
  - And U refreshes the session
  - Then U's JWT `app_metadata.role` reads `admin`

### R14 — Stale-claim convention documented
The project MUST document that the client calls `supabase.auth.refreshSession()` after
any role/org/tier change so the active JWT reflects the new claims.

## Capability: nodo_inmo table convention

### R15 — Reusable RLS templates defined
The foundation MUST provide two documented, copy-pasteable RLS templates that all future
`nodo_inmo` business tables apply, each carrying a non-null `org_id` FK to
`shared.organizations`:
- **Template A (staff-shared)**: SELECT/INSERT/UPDATE/DELETE scoped by JWT `org_id`,
  available to any internal staff (`admin` or `agent`).
- **Template B (admin-only)**: same, plus `role = 'admin'`, for sensitive modules.

## Capability: Role-based module access

### R17 — Sensitive modules are admin-only at the data layer
Modules marked admin-only in the module→role matrix (cash/`caja`, bank accounts,
financial reports) MUST enforce `role = 'admin'` in their RLS policies, not only in the
UI.

- **Scenario: agent blocked from admin-only data**
  - Given user U with `role = agent` in org A
  - And an admin-only (Template B) table holds rows for org A
  - When U selects from that table via the Data API (bypassing the UI)
  - Then zero rows are returned

- **Scenario: admin sees admin-only data**
  - Given user U with `role = admin` in org A
  - When U selects from the same admin-only table
  - Then U's org A rows are returned

### R18 — UI access mirrors but does not replace RLS
The frontend MUST hide modules a role cannot use, but this is presentation only; the
RLS gate (R17) is the authority. Hiding in the UI without the RLS gate is a defect.

## Verification gate

### R16 — Advisors clean before commit
`supabase db advisors` (or MCP `get_advisors`) MUST report no security errors for the
foundation before the migration is committed.

## Out of scope (restated)

Business entity tables, IPC/ICL calculation engine, INDEC ingestion, storage buckets,
realtime, frontend, and Nodo ID federation logic are NOT part of this change.
