# Exploration: nodo-inmo-foundation

## Current State

Greenfield project — no source code exists. Forward-looking exploration based on the domain model from the existing Django system and the decided tech stack: Vite SPA + React + Tailwind CSS v4 + Supabase.

---

## 1. DATABASE ARCHITECTURE

### Schema Separation Strategy

**Recommendation: Two explicit Postgres schemas within a single Supabase project.**

```
supabase project
├── shared schema        ← Nodo ecosystem shared data
│   ├── organizations    ← one row per agency = the multi-tenancy anchor
│   ├── org_members      ← user↔org membership + roles
│   ├── nodo_id          ← cross-product identity connector (Pro, Phase 2)
│   ├── indices          ← IPC/ICL historical values (INDEC reference data)
│   └── user_profiles    ← display name, avatar, cross-nodo identity
└── inmo schema          ← all real estate domain tables
    ├── properties
    ├── owners
    ├── tenants
    ├── contracts
    ├── payments
    ├── bank_accounts
    ├── cash_movements
    ├── property_expenses
    ├── sales_pipeline_leads
    ├── construction_projects
    ├── construction_expenses
    └── construction_tasks
```

**Why schemas over table prefixes:** Native Postgres namespacing, permission grants at schema level, future Nodo products each get their own schema. Cross-schema JOINs cost zero network overhead.

**Critical:** Non-public schemas need `GRANT USAGE ON SCHEMA inmo TO authenticated` and explicit Data API exposure in Supabase dashboard.

### Multi-Tenancy Approach

**Recommendation: org_id column + RLS (Approach A)**

Every `inmo` table gets `org_id uuid NOT NULL REFERENCES shared.organizations(id)`. RLS policies use the safe subquery form:

```sql
(select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
```

**Security notes:**
- Never use `user_metadata` for authorization — user-editable
- Use `app_metadata` for org_id, role, tier claims
- All UPDATE policies need both `USING` and `WITH CHECK`
- Views bypass RLS by default — use `security_invoker = true` (Postgres 15+)

### Key Design Decisions

- **IPC/ICL Indices:** Shared across all orgs in `shared.indices`. Edge Function via pg_cron pulls monthly. Manual admin fallback (INDEC API unreliable).
- **Multi-currency:** `numeric(15,2)` + `currency text CHECK (currency IN ('ARS', 'USD'))`. Conversion is application-layer only.
- **Guarantors:** Flat columns (guarantor_1_*, guarantor_2_*) — not normalized. Max=2 is a hard business rule.

---

## 2. FRONTEND ARCHITECTURE

### Portal Strategy

**Recommendation: Single SPA with lazy-loaded portal modules (Approach C)**

One deployment URL, Supabase Auth determines which portal loads, each portal's components are dynamically imported.

### Directory Structure

```
src/
├── app/
│   ├── router.tsx          ← role-based portal routing
│   └── providers.tsx       ← QueryClientProvider, SupabaseProvider
├── portals/
│   ├── admin/              ← properties, contracts, payments, cash, reports
│   ├── owner/              ← property view, payment history
│   └── tenant/             ← contract, payment history, claims
├── shared/
│   ├── components/         ← Button, Input, Badge, Table, Modal, CurrencyDisplay
│   ├── hooks/              ← useOrg, useAuth, useTier, useCurrency, useRealtime
│   ├── lib/
│   │   ├── supabase.ts     ← singleton Supabase client
│   │   ├── rent-calc.ts    ← pure IPC/ICL functions (unit-testable)
│   │   └── currency.ts     ← ARS/USD formatting
│   └── types/              ← domain types auto-generated from DB schema
└── features/
    └── feature-flags.ts    ← tier gating: useTier() → isPro
```

### State Management

**Recommendation: TanStack Query v5 + Zustand**

- Server state (Supabase data) → TanStack Query
- UI-local state (modals, filters, drafts) → Zustand
- Supabase Realtime → `queryClient.invalidateQueries()`
- Tier gating → `useTier()` reads JWT `app_metadata`, no external flag service

---

## 3. AUTH AND MULTI-TENANCY

### Role Model

| Role | Access scope |
|------|-------------|
| admin | Full CRUD for own org |
| agent | Properties/contracts CRUD, configurable financial read |
| owner | Read own properties + payment history |
| tenant | Read own contract + payments; create claims (Pro) |

### Role Storage

**Recommendation: org_members table + JWT sync (Approach B)**

`shared.org_members` is the source of truth. A Postgres trigger on UPDATE calls the Supabase Admin API (via trusted Edge Function) to patch `app_metadata`.

**Critical:** JWT staleness after role/tier changes — must force `supabase.auth.refreshSession()`.

### Onboarding Flows

- Admin: created by Nodo team, email+password
- Agent: invited by admin via magic link
- Owner: invited by admin via magic link (Starter+)
- Tenant: invited by admin via magic link (Pro)

### Nodo ID (Pro, Phase 2)

`shared.nodo_id` table maps `nodo_id_uuid → [org_id, product]`. Create table early, implement federation later.

---

## 4. MODULE PRIORITIZATION

### Phase 1 — MVP (Starter tier)

**P0 (launch blockers):**
1. Auth + org setup + invitation flows
2. Properties CRUD (status, type, photo via Storage)
3. Owners CRUD + owner portal (read-only)
4. Contracts CRUD (guarantors, index type, periodicity)
5. Rent collection — record payments, payment history
6. IPC/ICL calculation engine

**P1 (within first month post-launch):**
7. Bank accounts + cash movements
8. Property expense tracking (owner deduction flag)
9. Contract expiry alerts (pg_cron Edge Function)
10. Delinquency reports

### Phase 2 — Pro tier

11. Tenant portal
12. Sales pipeline (Interested → Reservation → Ticket → Deed)
13. WhatsApp bot integration
14. Mercado Pago integration
15. Gmail + Google Sheets sync
16. Nodo ID cross-product identity
17. Construction project module

---

## 5. SUPABASE-SPECIFIC PATTERNS

### RLS Policy Template

```sql
CREATE POLICY "org select" ON inmo.properties
  TO authenticated
  USING (org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "org insert" ON inmo.properties
  TO authenticated
  WITH CHECK (org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "org update" ON inmo.properties
  TO authenticated
  USING (org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
```

### Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `fetch-indec-indices` | pg_cron monthly | Pull IPC/ICL from INDEC API |
| `calculate-rent-adjustment` | pg_cron quarterly / on demand | Apply index to active contracts |
| `generate-payment-receipt` | On payment INSERT | PDF receipt for tenant |
| `send-contract-expiry-alerts` | pg_cron daily | Email alerts for expiring contracts |
| `sync-whatsapp` (Pro) | Webhook | WhatsApp Business API handler |

### Storage Buckets

```
property-photos/        ← public (listing photos)
  {org_id}/{property_id}/{filename}
documents/              ← private (contracts, expense receipts)
  {org_id}/{entity_type}/{entity_id}/{filename}
receipts/               ← private (generated PDFs)
  {org_id}/{contract_id}/{YYYY-MM}/{filename}
```

### Realtime

Subscriptions filtered by `org_id` on portal mount. Events trigger `queryClient.invalidateQueries()`. Unsubscribe on unmount mandatory.

---

## Risks

1. **RLS policy gaps** — silent data leaks. Every table needs all 4 policy types reviewed pre-launch.
2. **JWT staleness** — after role/tier changes, must force session refresh. Document as convention.
3. **INDEC API unreliability** — manual index entry fallback is P0, not optional.
4. **Non-public schema Data API exposure** — Supabase dashboard config step easy to miss.
5. **Construction module data model incomplete** — defer to Phase 2.
6. **Nodo ID federation protocol** — deferred; placeholder table only in Phase 1.
7. **Mobile-first** — Tailwind responsive design must be established from day 1.

---

## Recommendation

Proceed to proposal. Architecture is coherent. Main risks are operational (INDEC API, JWT staleness, RLS completeness) rather than architectural.
