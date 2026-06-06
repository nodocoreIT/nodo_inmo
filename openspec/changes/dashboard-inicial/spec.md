# Spec: dashboard-inicial (Leg 4)

**Change:** dashboard-inicial
**Phase:** spec
**Status:** ready

---

## Delta — What must be true after this change is applied

### DS-01 Landing route

The admin portal index (`/admin`) MUST redirect to `/admin/dashboard` instead of `/admin/properties`.

### DS-02 Route registration

A `<Route path="dashboard">` MUST be registered inside `AdminPortalPage` rendering the `DashboardPage` component.

### DS-03 Sidebar position

The dashboard nav item MUST be the first entry in `NAV_ITEMS` in `admin-layout.tsx`, appearing above "Propiedades".  
`ROUTE_TITLES["/admin/dashboard"]` MUST be defined and return a non-empty string label (e.g. `"Dashboard"`).

### DS-04 Feature module layout

The following files MUST exist:

```
src/features/dashboard/
  components/dashboard-page.tsx
  components/dashboard-stat-card.tsx
  hooks/use-dashboard-metrics.ts
  __tests__/dashboard-page.test.tsx
  __tests__/use-dashboard-metrics.test.ts
```

`DashboardPage` and `DashboardStatCard` are the only exported components from this module.  
`useDashboardMetrics` is the only exported hook.

### DS-05 `groupPendingByOwner` re-export

`groupPendingByOwner` MUST be re-exported from `src/features/caja/lib/caja-math.ts` (it already exists there; this requirement ensures it is in the public surface and importable by other modules without duplication).

### DS-06 `useDashboardMetrics` — composition contract

The hook MUST compose exactly these three existing hooks:

| Hook | Import path |
|------|-------------|
| `usePayments()` | `@/features/payments/hooks/use-payments` |
| `useOwnerSettlements()` | `@/features/caja/hooks/use-owner-settlements` |
| `useContracts()` | `@/features/contracts/hooks/use-contracts` |

It MUST NOT add any new `useQuery` call or Supabase query.

### DS-07 `useDashboardMetrics` — return shape

The hook MUST return an object satisfying this type:

```ts
interface CurrencyBreakdown {
  currency: string; // e.g. "ARS" | "USD"
  total: number;
  count: number;
}

interface DashboardMetrics {
  activeContractsCount: number;

  overduePayments: {
    count: number;
    byCurrency: CurrencyBreakdown[];
  };

  pendingSettlements: {
    ownerCount: number;        // distinct owners with at least one pending settlement
    byCurrency: CurrencyBreakdown[];
  };

  recentlySealed: {
    count: number;             // distinct settlement_group UUIDs within last 30 days
    byCurrency: CurrencyBreakdown[];
  };

  isLoading: boolean;
  isError: boolean;
}
```

`isLoading` MUST be `true` when ANY of the three underlying hooks has `isLoading === true`.  
`isError` MUST be `true` when ANY of the three underlying hooks has `isError === true`.

### DS-08 Active contracts derivation

`activeContractsCount` MUST equal the count of contracts where `contract.status === 'active'`.

### DS-09 Overdue payments derivation

A payment is overdue when `effectiveStatus(payment) === 'overdue'`.  
`effectiveStatus` MUST be imported from `@/features/payments/lib/payment-labels`, NOT re-implemented.

`overduePayments.byCurrency` MUST be grouped by `payment.currency`.  
ARS overdue total and USD overdue total MUST never be combined into a single number.  
`overduePayments.count` MUST equal the total count of overdue payment rows (not the number of currencies).

### DS-10 Pending settlements derivation

Pending settlements are settlements where `settlement.status === 'pending'`.  
Grouping MUST use `groupPendingByOwner` imported from `@/features/caja/lib/caja-math`.

`pendingSettlements.ownerCount` MUST equal the number of distinct `owner_id` values across pending settlements (independent of currency — one owner owing both ARS and USD counts as 1).  
`pendingSettlements.byCurrency` MUST aggregate totals per `currency`, never collapsing ARS into USD.

### DS-11 Recently sealed derivation

A sealed settlement qualifies when:
1. `settlement.status === 'settled'`, AND
2. `settlement.settled_date` is within the last 30 calendar days from the time the hook runs.

`recentlySealed.count` MUST equal the number of distinct `settlement_group` UUIDs that qualify (matching the grouping logic of `groupSealedBySettlementGroup`).  
`recentlySealed.byCurrency` MUST group qualifying seals by `currency`, summing the net amounts from `breakdown.net` where available; if `breakdown` is null, the row is excluded (matching guard 2 in `groupSealedBySettlementGroup`).

The 30-day window MUST be computed at derivation time; it MUST NOT be hardcoded as a fixed calendar date.

### DS-12 Multi-currency invariant (critical)

Across all four metrics:  
**ARS and USD MUST appear as separate entries in `byCurrency` arrays. They MUST never be summed together.**  
Any helper function that aggregates monetary values MUST accept a `currency` filter or operate per-currency.

### DS-13 `DashboardStatCard` — props contract

```ts
interface DashboardStatCardProps {
  label: string;
  primaryValue: string | number;
  byCurrency?: CurrencyBreakdown[];
  severity?: 'normal' | 'warning' | 'danger';
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
}
```

The card MUST render in a loading state (skeleton or spinner) when `isLoading` is `true`.  
The card MUST render an empty state with `emptyLabel` text when `isEmpty` is `true` and `isLoading` is `false`.  
When `byCurrency` is provided, each entry MUST be displayed separately — never summed.

### DS-14 `DashboardPage` — layout and states

`DashboardPage` MUST render exactly four stat cards in this order:
1. Active contracts
2. Overdue payments
3. Pending owner settlements
4. Recently sealed settlements

When `isLoading` is `true`, all four cards MUST show their loading state simultaneously.  
When `isError` is `true`, all four cards MUST show an error indicator.  
Each card independently shows its empty state when its own metric produces zero results.

### DS-15 `DashboardPage` — no direct data fetching

`DashboardPage` MUST NOT call `usePayments`, `useOwnerSettlements`, `useContracts`, or any `useQuery` directly. All data flows through `useDashboardMetrics`.

### DS-16 Data freshness

`usePayments`, `useOwnerSettlements`, and `useContracts` already have their own `staleTime` defaults. The dashboard MUST NOT set `staleTime` on these hooks or add wrapper queries — it reads live React Query state from the hooks as-is. A stale window of up to 60 seconds is acceptable for dashboard display purposes.

### DS-17 No backend changes

This change MUST NOT include:
- Supabase schema changes, migrations, or new RPC functions.
- New `useQuery` calls or Supabase queries.
- Changes to RLS policies.

---

## Acceptance Scenarios

### Scenario 1 — Landing redirect

**Given** an authenticated admin user  
**When** they navigate to `/admin` (the portal index)  
**Then** the browser URL changes to `/admin/dashboard` and `DashboardPage` is rendered.

---

### Scenario 2 — Dashboard is first sidebar item

**Given** the admin layout is rendered  
**When** the sidebar nav list is inspected  
**Then** the first `NavLink` points to `/admin/dashboard` and appears above the entry for `/admin/properties`.

---

### Scenario 3 — Page title is shown in the top bar

**Given** the user is on `/admin/dashboard`  
**When** the top bar header renders  
**Then** `ROUTE_TITLES["/admin/dashboard"]` resolves to a non-empty string and that string appears in the `<h1>` element.

---

### Scenario 4 — Active contracts count

**Given** `useContracts` returns 5 contracts: 3 with `status === 'active'`, 2 with `status === 'terminated'`  
**When** `useDashboardMetrics` derives metrics  
**Then** `activeContractsCount === 3`.

---

### Scenario 5 — Overdue payments: count and per-currency totals

**Given** `usePayments` returns 6 payments:
- 2 overdue, currency ARS, amounts 1000 and 2000
- 1 overdue, currency USD, amount 500
- 3 pending (not overdue)

**When** `useDashboardMetrics` derives metrics  
**Then**:
- `overduePayments.count === 3`
- `overduePayments.byCurrency` contains exactly two entries: `{ currency: 'ARS', total: 3000 }` and `{ currency: 'USD', total: 500 }`
- No single entry combines ARS and USD.

---

### Scenario 6 — Overdue payments: empty state

**Given** `usePayments` returns only `paid` payments  
**When** `useDashboardMetrics` derives metrics  
**Then** `overduePayments.count === 0` and `overduePayments.byCurrency` is an empty array.  
**And** the Overdue Payments stat card renders its empty state.

---

### Scenario 7 — Pending settlements: owner count and currency breakdown

**Given** `useOwnerSettlements` returns 4 rows with `status === 'pending'`:
- owner A, ARS 10000
- owner A, USD 200
- owner B, ARS 5000
- owner C, ARS 8000

**When** `useDashboardMetrics` derives metrics  
**Then**:
- `pendingSettlements.ownerCount === 3` (distinct owner_id values: A, B, C)
- `pendingSettlements.byCurrency` contains exactly two entries: `{ currency: 'ARS', total: 23000 }` and `{ currency: 'USD', total: 200 }`
- ARS and USD are never combined.

---

### Scenario 8 — Pending settlements: empty state

**Given** `useOwnerSettlements` returns only `settled` rows  
**When** `useDashboardMetrics` derives metrics  
**Then** `pendingSettlements.ownerCount === 0` and `pendingSettlements.byCurrency` is empty.  
**And** the Pending Settlements stat card renders its empty state.

---

### Scenario 9 — Recently sealed: 30-day window

**Given** today is T  
**And** `useOwnerSettlements` returns 4 settled rows:
- group-1, settled_date T-10, ARS, breakdown present
- group-2, settled_date T-25, USD, breakdown present
- group-3, settled_date T-31, ARS, breakdown present (older than 30 days)
- group-4, settled_date T-5, ARS, breakdown is null (guard 2 — excluded)

**When** `useDashboardMetrics` derives metrics  
**Then**:
- `recentlySealed.count === 2` (group-1 and group-2 only; group-3 is outside window, group-4 has null breakdown)
- `recentlySealed.byCurrency` contains entries for both ARS (group-1) and USD (group-2).

---

### Scenario 10 — Recently sealed: empty state

**Given** all settlements are either `pending` or `settled` with `settled_date` older than 30 days  
**When** `useDashboardMetrics` derives metrics  
**Then** `recentlySealed.count === 0` and `recentlySealed.byCurrency` is empty.  
**And** the Recently Sealed stat card renders its empty state.

---

### Scenario 11 — Loading state: any hook loading

**Given** `useContracts` has `isLoading === true` and the other hooks have loaded  
**When** `useDashboardMetrics` returns  
**Then** `isLoading === true`.  
**And** `DashboardPage` renders all four cards in their loading state.

---

### Scenario 12 — Error state: any hook errored

**Given** `useOwnerSettlements` has `isError === true`  
**When** `useDashboardMetrics` returns  
**Then** `isError === true`.  
**And** `DashboardPage` renders an error indicator (all cards reflect the error).

---

### Scenario 13 — Multi-currency invariant: ARS and USD never collapse

**Given** any metric produces payments or settlements in both ARS and USD  
**When** `byCurrency` is rendered in any stat card  
**Then** the ARS total and USD total appear as separate visual items.  
**And** no rendered number equals the arithmetic sum of ARS + USD amounts.

---

### Scenario 14 — `groupPendingByOwner` is importable from caja-math

**Given** a module outside the caja feature  
**When** it imports `{ groupPendingByOwner }` from `@/features/caja/lib/caja-math`  
**Then** the import resolves without error and the function operates correctly (existing unit tests remain green).

---

### Scenario 15 — No new queries introduced

**Given** the change is applied  
**When** the test suite runs with `usePayments`, `useOwnerSettlements`, and `useContracts` mocked  
**Then** no additional `supabase.from(...)` calls appear in the dashboard module's code paths.

---

### Scenario 16 — `DashboardPage` does not call data hooks directly

**Given** a component test for `DashboardPage` using a mocked `useDashboardMetrics`  
**When** the component renders  
**Then** `usePayments`, `useOwnerSettlements`, and `useContracts` are never called inside the component.

---

## Open Questions and Spec-Level Assumptions

| # | Assumption | Risk |
|---|------------|------|
| A1 | "Recently sealed = last 30 days" is the correct window. The proposal flagged this as open; the spec defaults to 30 calendar days and accepts it as a revisable constant. | Low — easy to change with no schema impact |
| A2 | `recentlySealed.byCurrency` uses `breakdown.net` as the representative amount per sealed group. If `breakdown` is null, the row is excluded consistent with `groupSealedBySettlementGroup` guard 2. | Low — consistent with existing grouping guards |
| A3 | `pendingSettlements.ownerCount` counts distinct `owner_id` values regardless of currency (one owner owing ARS and USD = 1). Currency distinction lives in `byCurrency`. | Low — matches proposal intent |
| A4 | `DashboardStatCard` is a local component, not extracted from `caja-page.tsx`. Visual parity with the caja stat card is desirable but not required; consolidation is explicitly out of scope. | Low |
| A5 | The recently sealed metric is derived from `useOwnerSettlements` (which fetches all settlements), not from `useSettledSettlements` (which has its own bounded query key). This keeps the dashboard to exactly 3 hooks. If performance becomes an issue, switching to `useSettledSettlements` is a valid follow-up. | Medium — `useOwnerSettlements` may return a large dataset; acceptable for now |
