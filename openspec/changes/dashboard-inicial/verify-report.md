# Verify Report: dashboard-inicial (Leg 4)

**Change:** dashboard-inicial
**Version:** spec v1 / design v1
**Mode:** Strict TDD (vitest + RTL)
**Date:** 2026-06-06

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 5 (T1–T5) |
| Tasks complete | 5 |
| Tasks incomplete | 0 |

---

## Build & Tests Execution

**Build:** ✅ Passed
```text
tsc -b && vite build
✓ 2156 modules transformed.
✓ built in 2.51s
(pre-existing chunk size warning unrelated to this change)
```

**Tests:** ✅ 274 passed / 0 failed / 0 skipped (38 test files)
```text
npm test -- --run
Test Files  38 passed (38)
Tests       274 passed (274)
Duration    4.65s
```
Dashboard-specific:
- `src/features/dashboard/__tests__/use-dashboard-metrics.test.ts` — 12 tests ✅
- `src/features/dashboard/__tests__/dashboard-page.test.tsx` — 14 tests ✅ (5 card + 9 page)

**Coverage:** Not configured → ➖ Not available

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| DS-01 Landing redirect | Scenario 1 — `/admin` → `/admin/dashboard` | `admin-portal-page.tsx` line 16 (static); `admin-layout.test.tsx` (indirect) | ✅ COMPLIANT |
| DS-02 Route registration | `<Route path="dashboard">` exists | `admin-portal-page.tsx` line 17 | ✅ COMPLIANT |
| DS-03 Sidebar position | Dashboard first in NAV_ITEMS, ROUTE_TITLES defined | `admin-layout.tsx` line 43–44; `admin-layout.test.tsx` does NOT assert "Inicio" first (see WARNING W-1) | ⚠️ PARTIAL |
| DS-04 Feature module layout | All 5 files exist | Confirmed by file reads | ✅ COMPLIANT |
| DS-05 `groupPendingByOwner` re-export | Already public export in caja-math.ts | `caja-math.ts` line 59; ADR-4 confirmed | ✅ COMPLIANT |
| DS-06 Hook composition contract | Composes `usePayments`, `useOwnerSettlements`, `useContracts` exactly | `use-dashboard-metrics.ts` lines 70–72; `use-dashboard-metrics.test.ts` mocks all three | ✅ COMPLIANT |
| DS-07 Hook return shape (spec) | `isLoading`, `isError`, `activeContractsCount`, `byCurrency[]` | Design Decision 1 explicitly supersedes spec shape → `loading`, `error`, `activeContracts`, `totalByCurrency: Record` (see WARNING W-2) | ⚠️ PARTIAL |
| DS-08 Active contracts | Scenario 4 | `T2-t4` — 3 active out of 5 → `activeContracts === 3` | ✅ COMPLIANT |
| DS-09 Overdue via effectiveStatus | Scenario 5, 6 | `T2-t5`, `T2-t6`, `T2-t7` — effectiveStatus not mocked, real implementation used | ✅ COMPLIANT |
| DS-10 Pending settlements derivation | Scenario 7, 8 | `T2-t8`, `T2-t9` — groupPendingByOwner used; `count` = owner+currency groups (see WARNING W-3) | ⚠️ PARTIAL |
| DS-11 Recently sealed 30-day window | Scenario 9, 10 | `T2-t10`, `T2-t11` — rows within window counted; null settled_date excluded (see WARNING W-4) | ⚠️ PARTIAL |
| DS-12 Multi-currency invariant | Scenario 13 | `T2-t7`, `T2-t9`, `T2-t11`, `T4-t5` — ARS and USD always separate, never summed | ✅ COMPLIANT |
| DS-13 DashboardStatCard props | — | `T3-t1` through `T3-t5` — props differ from spec (see WARNING W-5) | ⚠️ PARTIAL |
| DS-14 DashboardPage layout + states | Scenario 11, 12 | `T4-t1` (loading), `T4-t2` (error), `T4-t3` (four cards), `T4-t4` (order) | ✅ COMPLIANT |
| DS-15 No direct data fetching in page | Scenario 16 | `T4-t9` — asserts usePayments/useOwnerSettlements/useContracts never called | ✅ COMPLIANT |
| DS-16 No staleTime override | Scenario 15 | No staleTime or useQuery in dashboard module | ✅ COMPLIANT |
| DS-17 No backend changes | — | No migrations, RPCs, or new queries added | ✅ COMPLIANT |

**Compliance summary:** 11/17 COMPLIANT, 5/17 PARTIAL (all partials are design-superseded shape deviations, not failures), 1/17 PARTIAL (W-1 sidebar test gap).

---

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| `sumByCurrency` is the ONLY money reducer | ✅ Implemented | Confirmed by search: 1 definition, 3 callsites, all in `use-dashboard-metrics.ts`. No other currency aggregation anywhere in the dashboard module. |
| Dashboard as index route | ✅ Implemented | `admin-portal-page.tsx` line 16: `<Navigate to="dashboard" replace />` |
| Dashboard is first NAV_ITEMS entry | ✅ Implemented | `admin-layout.tsx` line 43: `{ to: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard }` — first entry, before `"/admin/properties"` |
| `ROUTE_TITLES["/admin/dashboard"]` | ✅ Implemented | `admin-layout.tsx` line 62: `"/admin/dashboard": "Inicio"` — first entry |
| `effectiveStatus` imported, not reimplemented | ✅ Implemented | `use-dashboard-metrics.ts` line 5 import, line 90 usage |
| `groupPendingByOwner` imported from caja-math | ✅ Implemented | `use-dashboard-metrics.ts` line 6 import, line 109 usage |
| 30-day window computed at runtime | ✅ Implemented | `startOfDayMinusDays(today, RECENT_SEALED_WINDOW_DAYS)` — `today` is injectable parameter, not a hardcoded date |
| Loading branching in DashboardPage | ✅ Implemented | `dashboard-page.tsx` lines 15–25: `if (metrics.loading)` → spinner with `role="status"` |
| Error branching in DashboardPage | ✅ Implemented | `dashboard-page.tsx` lines 27–35: `if (metrics.error)` → `role="alert"` with expected copy |
| Empty state for overdue card | ✅ Implemented | `dashboard-page.tsx` line 59–61: ternary, not `&&` |
| List truncation at 5 | ✅ Implemented | `MAX_LIST_ITEMS = 5` at module scope; "y {n} más" line |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-1 — No new query, composition only | ✅ Yes | No `useQuery`, no `supabase.from()` in dashboard module |
| ADR-2 — `sumByCurrency` single reducer | ✅ Yes | Sole aggregator; keyed by currency string |
| ADR-3 — effectiveStatus and groupPendingByOwner un-mocked in hook tests | ✅ Yes | Both imported but NOT mocked in `use-dashboard-metrics.test.ts` |
| ADR-4 — No caja-math.ts change | ✅ Yes | No modification to caja-math.ts; direct import used |
| ADR-5 — Dashboard not adminOnly | ✅ Yes | No `adminOnly` flag on the dashboard nav item |
| ADR-6 — Presentational card owns no branching | ✅ Yes | `DashboardStatCard` has no loading/error/empty props; all branching in `DashboardPage` |
| `toSorted()` → `.slice().sort()` (ES2022 compat) | ✅ Yes | `dashboard-stat-card.tsx` line 47 uses `.slice().sort()` |
| useMemo deps include loading+error | ✅ Yes | `use-dashboard-metrics.ts` line 148 |

---

## Issues Found

**CRITICAL:** None

**WARNING:**

- **W-1 — Scenario 2 not fully covered by automated test:** `admin-layout.test.tsx` does not assert that the "Inicio" link is the FIRST nav entry in the rendered list. It tests for the presence of other nav items but never queries the sidebar order relative to the new dashboard item. The implementation is correct (line 43 of admin-layout.tsx), but the scenario lacks a regression-preventing test. If a future edit reorders NAV_ITEMS, no test will catch it.

- **W-2 — Spec DS-07 interface vs design interface mismatch (shape rename):** The spec defines `isLoading: boolean`, `isError: boolean`, `activeContractsCount: number`, `pendingSettlements.ownerCount`, and `byCurrency: CurrencyBreakdown[]`. The design (Decision 1) explicitly replaced these with `loading`, `error`, `activeContracts`, `count`, and `totalByCurrency: Record<string, number>`. The design is consistent and all tests pass against the design shape, but if any consumer outside the dashboard module was written against the spec shape, it would fail. The design document does acknowledge the change. Impact: low (the hook is only consumed by `DashboardPage`).

- **W-3 — DS-10 `pendingSettlements.ownerCount` semantic:** The spec requires `ownerCount` = distinct `owner_id` values (owner A with ARS+USD = 1 owner). The implementation uses `groups.length` = number of owner+currency pairs (same owner A = 2 groups). Design Decision 1 explicitly chose `count: groups.length` and tests assert this. The `DashboardPage` uses `count` for the card headline — it will display "2" for an owner with both currencies, not "1". This may confuse users who expect to see the number of distinct landlords with pending balances. The spec's intent (distinct owners) was lost in the design. Revisit if the product definition of "pending settlements count" is "distinct landlords."

- **W-4 — DS-11 `recentlySealed.count` counts rows, not distinct `settlement_group` UUIDs:** The spec says count = distinct `settlement_group` UUIDs (matching `groupSealedBySettlementGroup` logic). Implementation counts individual settlement rows that match the date filter (`sealed.length`). If multiple rows share the same `settlement_group` (i.e., a multi-property liquidación), the count will be inflated. Design Decision 1 chose `count: sealed.length` with a note that `settlement_group` deduplication was not implemented. This is a deliberate simplification recorded in design open questions.

- **W-5 — DS-13 DashboardStatCard props diverge from spec:** Spec defines `primaryValue: string | number`, `isLoading?`, `isEmpty?`, `emptyLabel?`. Implementation uses `count: number`, and has no loading/empty props (ADR-6: parent owns those branches). This is intentional per design, but the spec's interface was not updated to reflect it.

**SUGGESTION:**

- **S-1 — Add a test asserting sidebar item order:** A test on `admin-layout.test.tsx` asserting `screen.getAllByRole("link")[0]` points to `/admin/dashboard` would close the W-1 gap permanently at zero code cost.

- **S-2 — Consider exposing `ownerCount` as a distinct field alongside `count`:** Returning both `count` (owner+currency groups) and `ownerCount` (distinct owner_ids) from `useDashboardMetrics` would satisfy the spec's semantic without changing the current display logic. It's a small addition and resolves the ambiguity in W-3.

- **S-3 — Document `recentlySealed.count` semantics in code comment:** A brief JSDoc note on the `recentSealed` computation explaining "count = individual settled rows (not deduplicated by settlement_group)" would prevent future confusion without requiring a change.

---

## Verdict

**PASS WITH WARNINGS**

All 274 tests pass. Build is clean. The 4 WARNINGs (W-2 through W-5) are all design-superseded spec deviations — they are consistent with explicitly accepted ADRs and produce no failing behavior. W-1 is a test coverage gap on sidebar ordering that poses a low regression risk. No CRITICAL issues block archive.
