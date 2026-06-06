# Tasks: dashboard-inicial (Leg 4)

**Change:** dashboard-inicial
**Phase:** tasks
**Status:** ready
**Delivery:** single PR

---

## Execution order

Tasks are numbered by dependency order. Tasks within the same group can proceed in parallel.

```
T1 (types + hook shell)
  └─ T2 (hook logic + tests)          ← depends T1
       ├─ T3 (DashboardStatCard)       ← depends T1 (CurrencyTotals type)
       │    └─ T4 (DashboardPage)      ← depends T2 + T3
       │         └─ T5 (routing)       ← depends T4
       └─ T5 (routing)                 ← depends T4
```

T3 and T2 share only the type (`CurrencyTotals`) — T3 can start once T1 ships.

---

## Task list

### T1 — Feature module skeleton + public types

**Spec:** DS-04 (file layout), DS-06 (composition contract), DS-07 (return shape)
**Group:** sequential — foundation, everything else builds on this

Create the directory structure and declare the public types. No logic yet.

Files to create:
- `src/features/dashboard/hooks/use-dashboard-metrics.ts` — declare exported types (`CurrencyTotals`, `MetricGroup`, `OverdueItem`, `PendingOwnerItem`, `DashboardMetrics`) and stub the hook signature:
  ```ts
  export function useDashboardMetrics(today: Date = new Date()): DashboardMetrics {
    throw new Error("not implemented");
  }
  ```
- `src/features/dashboard/components/dashboard-stat-card.tsx` — empty file with named export placeholder.
- `src/features/dashboard/components/dashboard-page.tsx` — empty file with named export placeholder.
- `src/features/dashboard/__tests__/use-dashboard-metrics.test.ts` — empty file (red tests written in T2).
- `src/features/dashboard/__tests__/dashboard-page.test.tsx` — empty file (red tests written in T4).

**Acceptance:** `tsc --noEmit` passes. Directory tree matches DS-04 exactly.

---

### T2 — `useDashboardMetrics` hook: write failing tests then implement

**Spec:** DS-06, DS-07, DS-08, DS-09, DS-10, DS-11, DS-12, DS-16, DS-17
**Group:** sequential — depends on T1

**TDD order: write ALL tests first (red), then implement (green), then refactor.**

#### Step A — write tests (all red)

File: `src/features/dashboard/__tests__/use-dashboard-metrics.test.ts`

Mock setup at the top (per-module):
```ts
vi.mock("@/features/payments/hooks/use-payments", () => ({ usePayments: vi.fn() }));
vi.mock("@/features/caja/hooks/use-owner-settlements", () => ({ useOwnerSettlements: vi.fn() }));
vi.mock("@/features/contracts/hooks/use-contracts", () => ({ useContracts: vi.fn() }));
```

`effectiveStatus` and `groupPendingByOwner` are NOT mocked — use the real implementations.

Fixed test date: `const FIXED_TODAY = new Date("2026-06-06")`.

Required test cases (each a separate `it` block):

1. **T2-t1: loading propagation** — set one hook to `isLoading: true`, others loaded. Assert `result.current.loading === true`.
2. **T2-t2: error propagation** — set one hook to `error: new Error("boom")`, others ok. Assert `result.current.error` is that error.
3. **T2-t3: loading false when all loaded** — all three hooks have `isLoading: false`. Assert `result.current.loading === false`.
4. **T2-t4: active contracts** — 5 contracts: 3 `status: 'active'`, 2 `status: 'terminated'`. Assert `result.current.activeContracts === 3`.
5. **T2-t5: overdue count + items** — 3 payments: 2 overdue (past `due_date`, `status: 'pending'`), 1 paid. Assert `overduePayments.count === 2`, `overduePayments.items.length === 2`.
6. **T2-t6: overdue tenantName fallback** — overdue payment with no `contract.tenant.name`. Assert `items[0].tenantName === "—"`.
7. **T2-t7: MULTI-CURRENCY — overdue ARS + USD never collapsed** — 1 overdue ARS 1000, 1 overdue USD 500. Assert `totalByCurrency['ARS'] === 1000`, `totalByCurrency['USD'] === 500`, keys length is 2. Assert the two values are never summed.
8. **T2-t8: pending settlements via groupPendingByOwner** — 3 settlements `status: 'pending'` for 2 owners (owner A: ARS + USD, owner B: ARS). Assert `pendingSettlements.count === 3` (3 owner+currency groups), `items.length === 3`, `ownerName` matches.
9. **T2-t9: MULTI-CURRENCY — pending ARS + USD never collapsed** — owner A: ARS 10000 + USD 200; owner B: ARS 5000. Assert `totalByCurrency['ARS'] === 15000`, `totalByCurrency['USD'] === 200`.
10. **T2-t10: recent sealed — 30-day window** — 3 settled rows: T-10 (in window), T-31 (outside), T-5 with `settled_date: null` (excluded). Assert `recentSealed.count === 1`.
11. **T2-t11: MULTI-CURRENCY — recent sealed ARS + USD** — T-10 ARS 5000 + T-5 USD 200 (both in window, both have settled_date). Assert `totalByCurrency['ARS'] === 5000`, `totalByCurrency['USD'] === 200`.
12. **T2-t12: empty data — no throws** — all hooks return `[]`. Assert all counts are `0`, all `totalByCurrency` are `{}`, no exception.

#### Step B — implement the hook (all tests green)

File: `src/features/dashboard/hooks/use-dashboard-metrics.ts`

Implement exactly as described in Design Decision 1:
- Imports: `usePayments`, `useOwnerSettlements`, `useContracts`, `effectiveStatus`, `groupPendingByOwner`. All direct (no barrels).
- Private helpers at module scope: `sumByCurrency<T>`, `startOfDayMinusDays`, `RECENT_SEALED_WINDOW_DAYS = 30`.
- `loading` and `error` computed outside `useMemo`.
- `useMemo` deps: `[payments.data, settlements.data, contracts.data, today, loading, error]`.
- `recentSealed`: filter `status === 'settled'` AND `settled_date != null` AND date within 30 days. Use the row's own `amount` and `currency` (NOT `breakdown.net` — see design open question note). `count = sealed.length`.
- No `useEffect`, no new `useQuery`, no Supabase import.

**Acceptance:** all 12 tests pass. `tsc --noEmit` clean.

---

### T3 — `DashboardStatCard` component + snapshot test

**Spec:** DS-13, DS-12
**Group:** can run in parallel with T2 (depends only on T1 types)

**TDD order: write tests first (red), then implement.**

#### Step A — write tests (red)

Add cases to `src/features/dashboard/__tests__/dashboard-page.test.tsx` (or a sibling `dashboard-stat-card.test.tsx` if preferred — colocate under `__tests__`):

1. **T3-t1: renders label and count** — pass `label="Overdue"`, `count={3}`. Assert both render.
2. **T3-t2: renders per-currency breakdown** — `totalByCurrency={{ ARS: 1000, USD: 50 }}`. Assert two separate currency lines render, no merged figure.
3. **T3-t3: omits money section when totalByCurrency absent** — no `totalByCurrency` prop. Assert no currency string renders.
4. **T3-t4: renders children** — pass a `<span>tenant name</span>` as children. Assert it renders below the card.
5. **T3-t5: severity danger applies destructive class** — `severity="danger"`. Assert destructive color class is present (use `data-testid` or role query).

#### Step B — implement (green)

File: `src/features/dashboard/components/dashboard-stat-card.tsx`

Per Design Decision 2:
- Props: `label`, `count`, `totalByCurrency?`, `severity?`, `icon?`, `children?`.
- Container: `rounded-md border border-border bg-card px-5 py-4 shadow-sm`.
- Severity color map hoisted to module scope (not inline).
- `Object.entries(totalByCurrency).sort(([a], [b]) => a.localeCompare(b))` for stable currency order.
- `formatMoney` imported from `@/features/contracts/lib/contract-labels` for currency formatting.
- Component defined at module scope, not nested.
- No `isLoading`/`isError` branching — purely presentational (Design ADR-6).

**Acceptance:** all T3 tests pass. `tsc --noEmit` clean.

---

### T4 — `DashboardPage` component + integration tests

**Spec:** DS-14, DS-15, DS-16, DS-13 (card display)
**Group:** sequential — depends on T2 + T3

**TDD order: write tests first (red), then implement.**

#### Step A — write tests (red)

File: `src/features/dashboard/__tests__/dashboard-page.test.tsx`

Mock at module top:
```ts
vi.mock("../hooks/use-dashboard-metrics", () => ({ useDashboardMetrics: vi.fn() }));
```

No router wrapper needed (no `NavLink` in the page).

Required test cases:

1. **T4-t1: loading state** — `useDashboardMetrics` returns `loading: true`. Assert `getByRole("status")` renders (spinner). Assert no card labels render.
2. **T4-t2: error state** — `loading: false`, `error: new Error("fail")`. Assert `getByRole("alert")` renders with error copy "Error al cargar el panel. Intentá de nuevo." Assert no card labels render.
3. **T4-t3: resolved — four cards render** — resolved metrics with data. Assert all four card labels appear: "Pagos vencidos", "Liquidaciones pendientes", "Liquidado (últimos 30 días)", "Contratos activos".
4. **T4-t4: resolved — card order** — assert "Pagos vencidos" appears before "Contratos activos" in the DOM.
5. **T4-t5: multi-currency display** — `overduePayments.totalByCurrency: { ARS: 1000, USD: 50 }`. Assert both currency strings appear separately. No merged figure.
6. **T4-t6: overdue list items** — `overduePayments.items` has 2 items with known tenant names. Assert both render.
7. **T4-t7: list truncation** — 7 overdue items. Assert "y 2 más" line renders.
8. **T4-t8: empty overdue card** — `overduePayments.count === 0`. Assert "Sin pagos vencidos" hint renders, no list rows.
9. **T4-t9: useDashboardMetrics called, not the underlying hooks** — assert `usePayments`, `useOwnerSettlements`, `useContracts` are never called in the component render (DS-15, DS-16).

#### Step B — implement (green)

File: `src/features/dashboard/components/dashboard-page.tsx`

Per Design Decision 3:
- Calls `useDashboardMetrics()`, owns the three render branches.
- Loading: centered spinner `role="status"` `aria-label="Cargando panel"` `.animate-spin`.
- Error: `role="alert"` destructive box with copy "Error al cargar el panel. Intentá de nuevo."
- Resolved: `<div className="grid grid-cols-1 gap-4 md:grid-cols-2">` with four `DashboardStatCard`s.
- Card order: overdue payments (`danger`) → pending settlements (`default`) → recently sealed (`success`) → active contracts (`default`).
- Icons (lucide): `AlertTriangle`, `Wallet`, `CheckCircle2`, `FileText`.
- Lists (cards 1 & 2): `MAX_LIST_ITEMS = 5` constant at module scope. Truncation line "y {n} más". Empty hint via ternary (not `&&`): "Sin pagos vencidos" / "Sin liquidaciones pendientes".
- No calls to `usePayments`, `useOwnerSettlements`, `useContracts`, or any `useQuery`.

**Acceptance:** all T4 tests pass. `tsc --noEmit` clean.

---

### T5 — Routing + sidebar wiring

**Spec:** DS-01, DS-02, DS-03
**Group:** sequential — depends on T4 (component must exist before route registration)

No TDD overhead here (route wiring is structural — covered by T4's component test indirectly). Verify manually via Scenario 1, 2, 3 acceptance criteria.

#### Changes

**File: `src/portals/admin/admin-portal-page.tsx`**

1. Add import: `import { DashboardPage } from "@/features/dashboard/components/dashboard-page";`
2. Change index redirect: `<Route index element={<Navigate to="dashboard" replace />} />`
3. Add route: `<Route path="dashboard" element={<DashboardPage />} />`

**File: `src/portals/admin/components/admin-layout.tsx`**

1. Add `LayoutDashboard` to the lucide import block.
2. Prepend nav item to `NAV_ITEMS`:
   ```ts
   { to: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard },
   ```
3. Add route title:
   ```ts
   "/admin/dashboard": "Inicio",
   ```
   (first entry in `ROUTE_TITLES`, above `"/admin/properties"`)

No `SEARCH_PLACEHOLDERS` entry for dashboard (no search box needed).

**Acceptance:**
- `tsc --noEmit` clean.
- Manual/E2E: navigating to `/admin` redirects to `/admin/dashboard`.
- Sidebar first item is "Inicio" with `LayoutDashboard` icon, above "Propiedades".
- Top bar h1 shows "Inicio" on the dashboard route.

---

## Commit convention (work-unit-commits)

Each task ships as its own commit. Suggested messages:

| Task | Commit message |
|------|---------------|
| T1 | `feat(dashboard): add feature module skeleton and public types` |
| T2 | `feat(dashboard): implement useDashboardMetrics hook with tests` |
| T3 | `feat(dashboard): add DashboardStatCard presentational component` |
| T4 | `feat(dashboard): add DashboardPage container with tests` |
| T5 | `feat(dashboard): wire routing and sidebar nav item` |

Each commit MUST leave CI green (build + tests pass) before the next task starts.

---

## Review Workload Forecast

| Dimension | Estimate |
|-----------|----------|
| New files | 5 (hook, 2 components, 2 test files) |
| Modified files | 2 (admin-portal-page.tsx, admin-layout.tsx) |
| Estimated changed lines | ~350–420 |
| Test cases | 26 (12 hook + 5 card + 9 page) |
| Chained PRs recommended | No |
| 400-line budget risk | Medium (borderline) |
| Decision needed before apply | No — single PR, borderline size is acceptable |

The bulk of the line count is the test suite (T2 + T4). The implementation surface is narrow: one hook, one presentational card, one container page, two small routing edits. Reviewer should focus on the `sumByCurrency` reducer and the multi-currency assertions (T2-t7, T2-t9, T2-t11, T4-t5) — these are the load-bearing correctness guarantees.
