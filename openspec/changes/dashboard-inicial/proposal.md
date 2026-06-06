# Proposal: dashboard-inicial (Leg 4)

## Intent

**Problem.** The admin portal has no landing dashboard. On login it redirects the index route straight to `/admin/properties`, so the operator opens a raw property list with zero situational awareness. There is no single screen that answers "what needs my attention right now?" — overdue payments, owner settlements waiting to be sealed, or active contract count are all scattered across separate feature screens.

**Why now.** This is Leg 4, the closing leg of the rendiciones roadmap. Legs 1–3 delivered property expenses, the atomic `settle_owner` RPC, and the PDF settlement statement. All the operational data the agency cares about now exists and is queryable through stable hooks. A dashboard is the natural capstone: it surfaces the value those legs created without adding any new data plumbing.

**Success looks like.** Logging into the admin portal lands on `/admin/dashboard`. In a single glance the operator sees: count of active contracts, overdue payments (count + totals grouped by currency), pending owner settlements (count + amounts), and recently sealed settlements from the last 30 days. Metrics are derived from existing data with no perceptible extra load and no new backend surface.

## Scope

### In scope
- New `src/features/dashboard/` feature module (page, stat card component, metrics hook, tests).
- A thin `useDashboardMetrics()` hook that composes the three existing data hooks (`usePayments`, `useOwnerSettlements`, `useContracts`) and derives display metrics client-side.
- Stat cards for: active contracts, overdue payments (count + totals by currency), pending owner settlements (count + amounts by currency), recently sealed settlements (last 30 days).
- Multi-currency correctness: every monetary total is grouped by currency (ARS / USD), never summed across currencies.
- Admin portal wiring: register the `/admin/dashboard` route, change the index redirect from `properties` to `dashboard`, prepend the nav item, and add the `ROUTE_TITLES` entry.
- Re-export `groupPendingByOwner` (currently private in `caja-math.ts`) so the dashboard can reuse settlement grouping logic instead of duplicating it.
- Unit/component tests for the metrics hook and the page.

### Out of scope
- Any database migration, new table, view, or RPC. RLS is already correct; no backend changes.
- New Supabase queries or data hooks. The dashboard consumes only existing hooks.
- Charts, time-series, historical trends, or analytics beyond the current-state counters described above.
- Date-range filters, drill-down navigation flows, or per-card configuration.
- Refactoring `caja-page.tsx`'s inlined `StatCard` into a shared component. The dashboard ships its own `DashboardStatCard`; consolidation is a separate concern.
- Role-based dashboard variants or non-admin portals.

## Approach

**Composition over new data.** The exploration confirmed all required data is already available through three hooks with correct RLS. The dashboard adds a derivation layer, not a data layer.

1. **`useDashboardMetrics()` (~60 lines).** Calls `usePayments()`, `useOwnerSettlements()`, and `useContracts()`. Derives:
   - Active contracts: `contracts.filter(c => c.status === 'active').length`.
   - Overdue payments: filter via the existing `effectiveStatus(p) === 'overdue'` (from `payment-labels.ts`), then reduce into a `{ currency -> total }` map plus a count.
   - Pending settlements: reuse the re-exported `groupPendingByOwner` (from `caja-math.ts`) over `status === 'pending'` settlements; expose count and amounts grouped by currency.
   - Recently sealed: `status === 'settled'` AND sealed within the last 30 days.
   Returns a single `loading` flag (OR of the underlying hook loading states) so the page can render one skeleton/empty path.

2. **`DashboardStatCard` (~50 lines).** A presentational card (label, primary value, optional currency breakdown, optional emphasis/severity styling for overdue). Defined locally in the dashboard feature — no dependency on the inlined caja `StatCard`.

3. **`DashboardPage` (~120 lines).** Container that calls the metrics hook and lays out the stat cards. Handles loading and empty states. Pure presentation; no data fetching beyond the hook.

4. **Portal wiring (~5 lines total).**
   - `src/portals/admin/admin-portal-page.tsx`: add the dashboard route, switch the index redirect to `dashboard`.
   - `src/portals/admin/components/admin-layout.tsx`: prepend the nav item and add a `ROUTE_TITLES` entry.

**Rationale.** Deriving client-side keeps the change small, reviewable, and migration-free while reusing battle-tested labeling/grouping logic (`effectiveStatus`, `groupPendingByOwner`). This avoids drift between dashboard numbers and the underlying caja/payments screens, since both read from the same source of truth. The single risk to manage carefully is the multi-currency grouping — totals must always be per-currency maps, never scalar sums.

## Out-of-Scope Note on Supabase

This change touches NO Supabase schema, RLS, functions, or storage. The supabase skill's security checklist (RLS, `SECURITY DEFINER`, views, storage policies) is not engaged by this proposal because the dashboard is a read-only client-side composition over already-secured hooks. If a future iteration adds a server-side aggregation RPC, that checklist must be applied at that time.

## Risks and Open Questions

- **`groupPendingByOwner` visibility.** It is currently private to `caja-math.ts`. The dashboard needs it; we re-export it rather than duplicate. Low risk, but it widens that module's public surface — keep the re-export minimal and intentional.
- **Multi-currency aggregation.** The most likely correctness bug. Every monetary metric must produce a per-currency breakdown (ARS / USD). Tests must assert that ARS and USD are never collapsed into one total.
- **`StatCard` duplication.** `caja-page.tsx` inlines its own `StatCard`. The dashboard intentionally defines `DashboardStatCard` instead of extracting/sharing now, accepting minor visual duplication to keep scope tight. Flag for a possible later consolidation.
- **Open question.** "Recently sealed = last 30 days" — is 30 days the right window, or should it be configurable / match an existing rendiciones convention? Defaulting to 30 days; revisit if the operator expects a different horizon.

## Estimated Size

~390 lines total across new feature files and ~5 lines of portal wiring. Single-PR friendly (well under the 400-line review budget). No migration, no new backend surface.

```
src/features/dashboard/
  components/dashboard-page.tsx              (~120)
  components/dashboard-stat-card.tsx         (~50)
  hooks/use-dashboard-metrics.ts             (~60)
  __tests__/dashboard-page.test.tsx          (~100)
  __tests__/use-dashboard-metrics.test.ts    (~60)
+ caja-math.ts re-export of groupPendingByOwner (~1)
+ admin portal wiring                        (~5)
```
