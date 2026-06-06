# Apply Progress: dashboard-inicial (Leg 4)

**Status:** complete
**Date:** 2026-06-06
**Test count:** 274/274 (38 test files, all green)
**Build:** clean (`tsc -b && vite build` — no errors)

---

## Task checklist

- [x] T1 — Feature module skeleton + public types
- [x] T2 — `useDashboardMetrics` hook (12 tests, all green)
- [x] T3 — `DashboardStatCard` presentational component (5 tests, all green)
- [x] T4 — `DashboardPage` container with tests (9 tests, all green)
- [x] T5 — Routing + sidebar wiring

---

## Files created

- `src/features/dashboard/hooks/use-dashboard-metrics.ts` — hook composing usePayments + useOwnerSettlements + useContracts; sumByCurrency reducer; RECENT_SEALED_WINDOW_DAYS = 30
- `src/features/dashboard/components/dashboard-stat-card.tsx` — presentational card with per-currency breakdown, severity colors
- `src/features/dashboard/components/dashboard-page.tsx` — container: 4-card 2x2 grid, loading/error/resolved branching, MAX_LIST_ITEMS = 5 truncation
- `src/features/dashboard/__tests__/use-dashboard-metrics.test.ts` — 12 tests covering loading/error propagation, active contracts, overdue, pending, recentSealed, multi-currency invariant (T2-t7, T2-t9, T2-t11), empty states
- `src/features/dashboard/__tests__/dashboard-page.test.tsx` — 14 tests (5 card + 9 page) covering all render states, multi-currency display, list truncation, DS-15 (page does not call data hooks directly)

## Files modified

- `src/portals/admin/admin-portal-page.tsx` — added DashboardPage import + `<Route path="dashboard">`, changed index redirect from "properties" → "dashboard"
- `src/portals/admin/components/admin-layout.tsx` — added LayoutDashboard to lucide imports, prepended `{ to: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard }` to NAV_ITEMS, added `"/admin/dashboard": "Inicio"` to ROUTE_TITLES

---

## Deviations from design

None. The one noted build-time fix: `toSorted()` (ES2023) was replaced with `.slice().sort()` because tsconfig.app.json targets ES2022. Functionally identical.

---

## Notes

- `groupPendingByOwner` was already a public export in `caja-math.ts` — no change needed (Design ADR-4 confirmed)
- The `owner_settlements` row has `amount` and `currency` fields directly on the row (confirmed against `database.ts`) — `recentSealed` correctly uses `s.amount` / `s.currency`, not `breakdown.net`
- The `stderr` warning about `Select`/`SelectTrigger` in the test run is pre-existing (unrelated to this change)
