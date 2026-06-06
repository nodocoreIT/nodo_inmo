# Archive Report: dashboard-inicial (Leg 4)

**Change:** dashboard-inicial  
**Phase:** archive  
**Status:** complete and closed  
**Date:** 2026-06-06

---

## Executive Summary

The dashboard-inicial change (Leg 4 of the rendiciones roadmap) has been implemented, tested, and verified. The admin portal now lands on a new `/admin/dashboard` homepage that surfaces operational metrics derived from existing data hooks with zero new backend surface. All 274 tests pass, the build is clean, and the change is ready for production.

---

## What Was Built

A new **dashboard feature module** (`src/features/dashboard/`) providing a single-glance landing screen for agency operators with four key metrics:

1. **Active Contracts** — count of `status === 'active'` contracts
2. **Overdue Payments** — count + per-currency totals (ARS and USD never summed)
3. **Pending Owner Settlements** — count of distinct owner+currency groups + per-currency totals
4. **Recently Sealed Settlements** — count of sealed rows from the last 30 days + per-currency breakdown

### Core Design

- **Composition pattern:** A single `useDashboardMetrics()` hook composes three existing data hooks (`usePayments`, `useOwnerSettlements`, `useContracts`) and derives metrics via pure `useMemo`. No new queries, no new Supabase surface.
- **Currency safety:** A single `sumByCurrency()` reducer ensures ARS and USD totals are always kept separate and never collapsed.
- **Reuse:** Derivations reuse existing logic (`effectiveStatus` for payment status, `groupPendingByOwner` for settlement grouping) so dashboard numbers can never drift from their source features.
- **Routing:** The admin index now redirects to `/admin/dashboard` instead of `/admin/properties`; the dashboard is the first nav item in the sidebar.

---

## Test Summary

**Final test count: 274/274 tests pass (38 test files, all green)**

Dashboard-specific tests:
- `use-dashboard-metrics.test.ts` — 12 tests covering loading/error propagation, four metric derivations, multi-currency invariant (critical), empty states
- `dashboard-page.test.tsx` — 14 tests covering all three render branches (loading, error, resolved), card layout, list truncation, DS-15 compliance (page does not call data hooks directly)

**Build:** Clean (`tsc -b && vite build` — no errors)

---

## Key Decisions Recorded

### ADR-1 — Composition over new queries
**Chosen:** Derivation layer over existing hooks. **Rejected:** Server-side aggregation RPC (adds backend complexity and drift risk) or duplicating queries (double-fetch and sync burden). Rationale: smallest change, provably aligned with existing feature definitions.

### ADR-2 — Single currency reducer
**Chosen:** `sumByCurrency<T>()` function keyed by currency string; all money is `Record<currency, number>`. **Rejected:** Scalar totals or collapsing currencies. Tests assert ARS and USD never merge.

### ADR-3 — Drift protection via real imports
**Chosen:** `effectiveStatus` and `groupPendingByOwner` are NOT mocked in hook tests. **Rejected:** Re-implementing predicates. This guarantees dashboard "overdue" and "pending" definitions stay synchronized with caja/payments.

### ADR-4 — No caja-math.ts change
**Finding:** `groupPendingByOwner` is already a public export. Eliminates the proposal's re-export task and its main risk (widening module surface).

### ADR-5 — Dashboard not adminOnly
**Chosen:** Everyone lands on dashboard; RLS scopes settlement data. **Rejected:** Gating the whole route (would block index redirect for non-admin portal users). Non-admins see empty settlement metrics safely.

### ADR-6 — Presentational card, container branching
**Chosen:** `DashboardStatCard` receives resolved numbers only; all loading/error/empty branching lives in `DashboardPage`. Matches existing caja pattern.

---

## Files Changed

### Created
- `src/features/dashboard/hooks/use-dashboard-metrics.ts` — hook composing three data hooks; `sumByCurrency` reducer; `RECENT_SEALED_WINDOW_DAYS = 30` constant; private date helpers
- `src/features/dashboard/components/dashboard-stat-card.tsx` — presentational card with per-currency breakdown, severity colors (danger/default/success)
- `src/features/dashboard/components/dashboard-page.tsx` — container with 2x2 grid, three render branches (loading/error/resolved), MAX_LIST_ITEMS = 5 truncation
- `src/features/dashboard/__tests__/use-dashboard-metrics.test.ts` — 12 unit tests
- `src/features/dashboard/__tests__/dashboard-page.test.tsx` — 14 integration tests

### Modified
- `src/portals/admin/admin-portal-page.tsx` — added `DashboardPage` import, changed index redirect to `"dashboard"`, added `<Route path="dashboard" element={<DashboardPage />} />`
- `src/portals/admin/components/admin-layout.tsx` — added `LayoutDashboard` icon import, prepended `{ to: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard }` to `NAV_ITEMS`, added `"/admin/dashboard": "Inicio"` to `ROUTE_TITLES`

---

## Known Limitations and Caveats

All of the following are **design-intentional** and recorded in the verification report:

1. **W-3 — `pendingSettlements.count` semantic ambiguity:** The spec required distinct owner count; the design chose owner+currency group count. The card headline will show "2" for an owner with both ARS and USD pending balances, not "1" (distinct owners). Revisit if product definition of "pending settlements" should be "distinct landlords."

2. **W-4 — `recentlySealed.count` counts rows, not distinct settlement groups:** If a multi-property liquidación has multiple settlement rows, the count includes all rows, not the deduplicated `settlement_group` UUID. This is a recorded simplification; full grouping can be added if precision becomes necessary.

3. **W-1 — Sidebar order test gap:** `admin-layout.test.tsx` does not assert that "Inicio" is the FIRST sidebar link. The implementation is correct, but a regression test would close this gap. See Suggestion S-1 in the verify report.

4. **Design shape vs spec shape:** The spec interface was superseded by the design. Consumers of `useDashboardMetrics` see `loading` / `error` / `activeContracts` / `totalByCurrency: Record<string, number>` instead of the spec's `isLoading` / `isError` / `activeContractsCount` / `byCurrency: CurrencyBreakdown[]`. This is intentional and only affects the internal `DashboardPage` consumer (low impact).

---

## Verification Status

**Verdict:** PASS WITH WARNINGS (from verify-report.md)

- **11/17 spec requirements** directly compliant
- **6/17 spec requirements** PARTIAL (all due to design-accepted deviations, zero functional failures)
- **All 274 tests** pass
- **No CRITICAL issues** block archive
- **4 WARNINGs** recorded (W-1 through W-4); 3 are design-superseded, 1 is a test coverage gap

---

## Artifacts (Topic Keys and Observation IDs)

All artifacts are persisted in `openspec/changes/dashboard-inicial/`:

| Artifact | File | Status |
|----------|------|--------|
| Proposal | `proposal.md` | ✅ Read during archive |
| Spec | `spec.md` | ✅ Read during archive |
| Design | `design.md` | ✅ Read during archive |
| Tasks | `tasks.md` | ✅ Read during archive |
| Apply Progress | `apply-progress.md` | ✅ Read during archive |
| Verify Report | `verify-report.md` | ✅ Read during archive |
| Archive Report | `archive-report.md` | ✅ Written (this file) |

---

## Checklist Before Archive

- [x] All 5 tasks (T1–T5) complete
- [x] 274/274 tests passing
- [x] Build clean (`tsc -b && vite build`)
- [x] No migration or backend surface changes
- [x] Multi-currency invariant enforced (sumByCurrency as sole reducer)
- [x] Reuse of existing logic confirmed (effectiveStatus, groupPendingByOwner)
- [x] Routing wired (index redirect, nav item, ROUTE_TITLES)
- [x] Spec scenarios verified (Scenarios 1–16 covered by tests or static evidence)
- [x] Design ADRs followed (ADR-1 through ADR-6)
- [x] Known limitations documented (W-1 through W-4)

---

## Next Steps

**None.** The change is complete and closed. The dashboard-inicial feature is ready for production deployment.

If a follow-up is needed:
- **S-1:** Add a test assertion on sidebar item order (trivial addition to `admin-layout.test.tsx`)
- **S-2:** Expose `ownerCount` alongside `count` in `useDashboardMetrics` if the distinct-owner semantic becomes a product requirement
- **S-3:** Add a code comment explaining `recentlySealed.count` semantics to prevent future confusion
- **W-1:** Consider a server-side aggregation RPC if performance testing reveals the dashboard's parallel hook fetch is a bottleneck (out of scope; revisit only if needed)

---

## Compliance Summary

| Dimension | Status |
|-----------|--------|
| Spec compliance | 11/17 direct, 6/17 design-superseded (no failures) |
| Test pass rate | 274/274 (100%) |
| Build status | Clean |
| Backend changes | None (zero new RPCs, queries, migrations) |
| Multi-currency correctness | Enforced via sumByCurrency reducer |
| Code reuse | effectiveStatus + groupPendingByOwner un-mocked in tests |
| Design coherence | All 6 ADRs followed |
| Risks | Mitigated (known limitations documented, low impact) |

**Archive Status:** ✅ COMPLETE

