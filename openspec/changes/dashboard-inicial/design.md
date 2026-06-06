# Design: dashboard-inicial (Leg 4)

## Architecture Approach

**Pattern: derivation layer over existing data hooks (composition, not data plumbing).**

The dashboard is a screaming-architecture feature module (`src/features/dashboard/`) that follows the same container/presentational split already used across the codebase:

- **Data/derivation layer** — `useDashboardMetrics()` composes the three existing TanStack Query hooks (`usePayments`, `useOwnerSettlements`, `useContracts`) and derives display metrics with pure, currency-safe reductions. It adds NO new query, NO new Supabase surface.
- **Presentational layer** — `DashboardStatCard` is a dumb card (props in, JSX out, zero data access). `DashboardPage` is a thin container: it calls the hook, owns loading/error/empty branching, and lays out cards + lists.
- **Pure logic reuse** — currency-correct grouping reuses `groupPendingByOwner` (re-exported from `caja-math.ts`) and status derivation reuses `effectiveStatus` (`payment-labels.ts`). This guarantees the dashboard numbers can never drift from the Caja/Pagos screens, because both read the same source of truth.

**Boundary rule:** the dashboard feature depends OUTWARD on `caja`, `payments`, `contracts` libs/hooks. Those features must not depend back on `dashboard`. The single new cross-feature surface is the `groupPendingByOwner` re-export, which already exists as a public export in `caja-math.ts` (it is imported by `caja-page.tsx` today) — so no visibility change is actually required (see ADR-4).

**Re-render / waterfall note (vercel-react-best-practices):** the three hooks are independent TanStack queries; they already fire in parallel on mount (no waterfall — `async-parallel` satisfied by React Query's independent `queryKey`s). All derivation is wrapped in a single `useMemo` keyed on the three `data` references (`rerender-derived-state-no-effect`: derive during render, never via `useEffect`). No state is introduced in the hook.

## Component Map

```
src/features/dashboard/
  hooks/use-dashboard-metrics.ts        composes 3 hooks → DashboardMetrics
  components/dashboard-stat-card.tsx     presentational card
  components/dashboard-page.tsx          container + layout
  __tests__/use-dashboard-metrics.test.ts
  __tests__/dashboard-page.test.tsx
```

Data flow:

```
usePayments ─┐
useOwnerSettlements ─┼─► useDashboardMetrics (useMemo derive) ─► DashboardMetrics
useContracts ─┘                                                      │
                                                                     ▼
                                                  DashboardPage (loading/error/empty)
                                                                     │
                                          ┌──────────────┬───────────┴──────────┐
                                          ▼              ▼                       ▼
                                  DashboardStatCard  DashboardStatCard   list of names below card
```

## Decision 1 — `useDashboardMetrics()` hook

**File:** `src/features/dashboard/hooks/use-dashboard-metrics.ts`

### Public types

```ts
/** A per-currency monetary breakdown. Keys are currency codes (e.g. "ARS", "USD").
 *  NEVER collapse different currencies into one scalar. */
export type CurrencyTotals = Record<string, number>;

export interface MetricGroup {
  count: number;
  totalByCurrency: CurrencyTotals;
}

/** Lightweight rows the page renders as a short list under each card. */
export interface OverdueItem {
  id: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  currency: string;
  dueDate: string;
}

export interface PendingOwnerItem {
  ownerId: string;
  ownerName: string;
  total: number;
  currency: string;
}

export interface DashboardMetrics {
  overduePayments: MetricGroup & { items: OverdueItem[] };
  pendingSettlements: MetricGroup & { items: PendingOwnerItem[] };
  recentSealed: MetricGroup;
  activeContracts: number;
  loading: boolean;
  error: unknown;
}
```

> Note: the proposal's contract specified `{ count, totalByCurrency }` for the three money metrics plus `activeContracts`, `loading`, `error`. This design keeps that exact shape and ADDITIVELY attaches `items[]` to the two metrics the page renders lists for (overdue, pending). `recentSealed` has no list (count + totals only), matching the proposal.

### Signature

```ts
export function useDashboardMetrics(today: Date = new Date()): DashboardMetrics
```

`today` is injectable for deterministic tests (same convention as `effectiveStatus`).

### Behavior

```ts
export function useDashboardMetrics(today: Date = new Date()): DashboardMetrics {
  const payments = usePayments();
  const settlements = useOwnerSettlements();
  const contracts = useContracts();

  const loading = payments.isLoading || settlements.isLoading || contracts.isLoading;
  const error = payments.error ?? settlements.error ?? contracts.error ?? null;

  return useMemo<DashboardMetrics>(() => {
    const paymentRows = payments.data ?? [];
    const settlementRows = settlements.data ?? [];
    const contractRows = contracts.data ?? [];

    // Active contracts
    const activeContracts = contractRows.filter((c) => c.status === "active").length;

    // Overdue payments → per-currency totals + items
    const overdue = paymentRows.filter((p) => effectiveStatus(p, today) === "overdue");
    const overduePayments = {
      count: overdue.length,
      totalByCurrency: sumByCurrency(overdue, (p) => ({ amount: p.amount, currency: p.currency })),
      items: overdue.map((p) => ({
        id: p.id,
        tenantName: p.contract?.tenant?.name ?? "—",
        propertyAddress: p.contract?.property?.address ?? "—",
        amount: p.amount,
        currency: p.currency,
        dueDate: p.due_date,
      })),
    };

    // Pending settlements → reuse groupPendingByOwner (already per owner+currency)
    const groups = groupPendingByOwner(settlementRows);
    const pendingSettlements = {
      count: groups.length,
      totalByCurrency: sumByCurrency(groups, (g) => ({ amount: g.total, currency: g.currency })),
      items: groups.map((g) => ({
        ownerId: g.owner_id,
        ownerName: g.owner_name,
        total: g.total,
        currency: g.currency,
      })),
    };

    // Recently sealed (last 30 days) → per-currency totals + count
    const cutoff = startOfDayMinusDays(today, RECENT_SEALED_WINDOW_DAYS);
    const sealed = settlementRows.filter(
      (s) =>
        s.status === "settled" &&
        s.settled_date != null &&
        new Date(s.settled_date) >= cutoff,
    );
    const recentSealed = {
      count: sealed.length,
      totalByCurrency: sumByCurrency(sealed, (s) => ({ amount: s.amount, currency: s.currency })),
    };

    return { overduePayments, pendingSettlements, recentSealed, activeContracts, loading, error };
  }, [payments.data, settlements.data, contracts.data, today, loading, error]);
}
```

### Private pure helpers (same file, module scope)

```ts
const RECENT_SEALED_WINDOW_DAYS = 30;

function sumByCurrency<T>(rows: T[], pick: (row: T) => { amount: number; currency: string }): CurrencyTotals {
  const out: CurrencyTotals = {};
  for (const row of rows) {
    const { amount, currency } = pick(row);
    out[currency] = (out[currency] ?? 0) + amount;
  }
  return out;
}

function startOfDayMinusDays(today: Date, days: number): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}
```

**Currency invariant (load-bearing):** `sumByCurrency` is the ONLY money reducer. It keys strictly by `currency` and can never collapse ARS + USD. Tests assert this directly (see Decision 6).

**Imports:** `usePayments` from `@/features/payments/hooks/use-payments`, `useOwnerSettlements` from `@/features/caja/hooks/use-owner-settlements`, `useContracts` from `@/features/contracts/hooks/use-contracts`, `effectiveStatus` from `@/features/payments/lib/payment-labels`, `groupPendingByOwner` from `@/features/caja/lib/caja-math`. Direct module imports (no barrels — `bundle-barrel-imports`).

## Decision 2 — `DashboardStatCard` component

**File:** `src/features/dashboard/components/dashboard-stat-card.tsx`

Presentational, mirrors the visual shape of the inlined caja `StatCard` (`rounded-md border border-border bg-card px-5 py-4 shadow-sm`, uppercase label, large value) but extended for multi-currency and severity.

### Props

```ts
type Severity = "default" | "danger" | "success";

interface DashboardStatCardProps {
  label: string;
  /** Headline value, usually a count (e.g. "3" overdue, "12" active contracts). */
  count: number;
  /** Optional per-currency money breakdown rendered under the count. Omit for pure counts. */
  totalByCurrency?: CurrencyTotals;
  /** Visual emphasis: "danger" for overdue, "success" for sealed, "default" otherwise. */
  severity?: Severity;
  icon?: React.ElementType;
  /** Optional list rendered below the value (e.g. overdue tenant names). */
  children?: React.ReactNode;
}
```

### Render shape

- Container: same classes as caja `StatCard`.
- Label row: `icon` (if any) + uppercase label. Color driven by `severity` (`text-destructive` / `text-green-700` / `text-slate2`).
- Headline: `count` at `text-2xl font-bold`, colored by severity.
- Money breakdown: if `totalByCurrency` provided and non-empty, render one line per currency via `formatMoney(total, currency)` (imported from `@/features/contracts/lib/contract-labels`). Use `Object.entries(totalByCurrency)` sorted by currency for stable order (`js-tosorted-immutable`).
- `children`: rendered in a bordered list region below.

### Loading / error states

`DashboardStatCard` is purely presentational and does NOT render loading/error itself — those are owned by `DashboardPage` (single source of branching, matching the caja pattern where the parent owns the spinner/alert). The card only ever receives resolved numbers.

Static JSX with no props (severity color maps) is hoisted to module scope (`rendering-hoist-jsx`); the component is defined at module scope, never nested (`rerender-no-inline-components`).

## Decision 3 — `DashboardPage` component

**File:** `src/features/dashboard/components/dashboard-page.tsx`

Container. Calls `useDashboardMetrics()`, owns the three render branches, lays out the cards.

### Branching (mirrors caja exactly)

1. **loading** → centered spinner (`role="status"`, `aria-label="Cargando panel"`, `.animate-spin` ring — copy the caja markup).
2. **error** → `role="alert"` destructive box: "Error al cargar el panel. Intentá de nuevo."
3. **resolved** → the grid.

There is no global empty state — a fresh agency still sees the cards (all showing `0`), which is correct situational awareness. Individual lists handle their own emptiness (see below).

### Layout

**2x2 responsive grid:** `grid grid-cols-1 gap-4 md:grid-cols-2`. Order (reading priority — what needs attention first):

| Position | Card | severity | count source | money | list |
|---|---|---|---|---|---|
| 1 (top-left) | Pagos vencidos | `danger` | `overduePayments.count` | `overduePayments.totalByCurrency` | top N overdue tenant + address |
| 2 (top-right) | Liquidaciones pendientes | `default` | `pendingSettlements.count` | `pendingSettlements.totalByCurrency` | top N owner names + amount |
| 3 (bottom-left) | Liquidado (últimos 30 días) | `success` | `recentSealed.count` | `recentSealed.totalByCurrency` | none |
| 4 (bottom-right) | Contratos activos | `default` | `activeContracts` | none (pure count) | none |

**List rendering under cards 1 & 2:** render up to `MAX_LIST_ITEMS = 5` items as `children`. Each row: primary name + secondary detail + `formatMoney`. If `items.length > MAX_LIST_ITEMS`, append a muted "y N más" line. If a card's `count === 0`, render a short muted empty hint instead of an empty list (e.g. "Sin pagos vencidos", "Sin liquidaciones pendientes") — `rendering-conditional-render` (ternary, not `&&`).

Icons (lucide, already a dependency): `AlertTriangle` (overdue), `Wallet` (pending), `CheckCircle2` (sealed), `FileText` (contracts).

The page is the default-exported route component but exported as a named `DashboardPage` to match the codebase convention (all other portal pages are named exports).

## Decision 4 — `caja-math.ts` change

**Finding (correction to the proposal):** `groupPendingByOwner` is ALREADY a public `export function` in `caja-math.ts` (line 59) and is already imported by `caja-page.tsx`. It is NOT private.

**Therefore: no change to `caja-math.ts` is required.** The dashboard imports it directly:

```ts
import { groupPendingByOwner } from "@/features/caja/lib/caja-math";
```

The proposal's "re-export `groupPendingByOwner`" task collapses to "import the existing public export." This REMOVES the proposal's main flagged risk (widening module surface) — the surface is already where it needs to be. `OwnerGroup` and `SettlementLike` types are likewise already exported and reusable.

> If a future reviewer wants a narrower public boundary, that is a separate refactor and explicitly out of scope here.

## Decision 5 — Routing wiring

### `src/portals/admin/admin-portal-page.tsx`

Add the import and route; switch the index redirect.

```diff
 import { CajaPage } from "@/features/caja/components/caja-page";
+import { DashboardPage } from "@/features/dashboard/components/dashboard-page";

       <Route element={<AdminLayout />}>
-        {/* Default → properties */}
-        <Route index element={<Navigate to="properties" replace />} />
+        {/* Default → dashboard */}
+        <Route index element={<Navigate to="dashboard" replace />} />
+        <Route path="dashboard" element={<DashboardPage />} />
         <Route path="properties" element={<PropertiesList />} />
```

### `src/portals/admin/components/admin-layout.tsx`

Prepend the nav item (use the existing `LayoutDashboard` lucide icon — add to the import block) and add a `ROUTE_TITLES` entry.

```diff
-import {
-  Home,
+import {
+  LayoutDashboard,
+  Home,

 const NAV_ITEMS: NavItem[] = [
+  { to: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard },
   { to: "/admin/properties", label: "Propiedades", icon: Home },

 const ROUTE_TITLES: Record<string, string> = {
+  "/admin/dashboard": "Inicio",
   "/admin/properties": "Propiedades",
```

No `SEARCH_PLACEHOLDERS` entry — the dashboard has no search. `title` falls back correctly via `ROUTE_TITLES["/admin/dashboard"] = "Inicio"`. The dashboard is NOT `adminOnly` (any authenticated portal user lands here); RLS already scopes the underlying data, and `useOwnerSettlements` is admin-only at the RLS layer, so a non-admin simply sees empty settlement metrics — acceptable and safe.

## Decision 6 — Test design

**Runner:** vitest + React Testing Library (Strict TDD mode active — write the failing test first, then the implementation, per `strict-tdd.md`).

### A. `__tests__/use-dashboard-metrics.test.ts` (pure hook logic)

Mock the three composed hooks per-module so we control `data` / `isLoading` / `error` directly. `effectiveStatus` and `groupPendingByOwner` are NOT mocked — we exercise the real reuse path (drift protection is the whole point).

```ts
vi.mock("@/features/payments/hooks/use-payments", () => ({ usePayments: vi.fn() }));
vi.mock("@/features/caja/hooks/use-owner-settlements", () => ({ useOwnerSettlements: vi.fn() }));
vi.mock("@/features/contracts/hooks/use-contracts", () => ({ useContracts: vi.fn() }));
```

Render via `renderHook(() => useDashboardMetrics(FIXED_TODAY))` with `FIXED_TODAY = new Date("2026-06-06")`.

Key cases:
1. **loading propagation** — any one hook `isLoading: true` → `loading === true`.
2. **error propagation** — any one hook `error` set → `error` is that error (first non-null wins).
3. **active contracts** — mixed statuses → counts only `status === "active"`.
4. **overdue derivation** — payments with past `due_date` + `status: "pending"` count as overdue; `paid`/`cancelled`/future excluded. Assert `count` and `items[].tenantName`.
5. **MULTI-CURRENCY INVARIANT (critical)** — overdue with ARS and USD rows → `totalByCurrency` has BOTH keys with SEPARATE sums; assert they are never added together. Repeat for `pendingSettlements` and `recentSealed`.
6. **pending settlements** — only `status: "pending"` grouped; `count` = number of owner+currency groups (via real `groupPendingByOwner`).
7. **recent sealed window** — `status: "settled"` with `settled_date` 10 days ago is counted; 40 days ago is excluded; null `settled_date` excluded.
8. **empty data** — all hooks return `[]` → all counts `0`, all `totalByCurrency` `{}`, no throw.

### B. `__tests__/dashboard-page.test.tsx` (component)

Mock `useDashboardMetrics` itself (the page is a thin presenter; the hook is tested in A).

```ts
vi.mock("../hooks/use-dashboard-metrics", () => ({ useDashboardMetrics: vi.fn() }));
```

Wrap in a router only if any link is rendered (the page has no `NavLink`s, so a bare render suffices). Key cases:
1. **loading** → spinner via `getByRole("status")`.
2. **error** → `getByRole("alert")` with the error copy.
3. **resolved happy path** → asserts the four card labels render, the overdue count renders, and a known tenant name appears in the overdue list.
4. **multi-currency display** → overdue `totalByCurrency: { ARS: 1000, USD: 50 }` → both `formatMoney` outputs appear (ARS and USD lines), not a single merged figure.
5. **empty card** → `overduePayments.count === 0` → "Sin pagos vencidos" hint renders, no list rows.
6. **list truncation** → `items.length > 5` → "y N más" line renders.

**File locations:** both under `src/features/dashboard/__tests__/`, matching the colocated `__tests__` convention used elsewhere in the repo.

## ADR Summary

- **ADR-1 — Compose existing hooks, no new query.** Chosen: derivation layer over `usePayments`/`useOwnerSettlements`/`useContracts`. Rejected: a server-side aggregation RPC (adds backend surface, RLS review, and drift risk for zero current benefit). Rejected: duplicating the Supabase queries inside the dashboard (drift + double fetch). Rationale: smallest, migration-free change; numbers provably consistent with Caja/Pagos.
- **ADR-2 — Per-currency maps everywhere, one reducer.** Chosen: single `sumByCurrency` helper keyed by `currency`; all money is `Record<currency, number>`. Rejected: scalar totals (silently wrong across ARS/USD). Tests assert non-collapse.
- **ADR-3 — Reuse `effectiveStatus` and `groupPendingByOwner` un-mocked in tests.** Chosen: real logic in the hook test so dashboard "overdue"/"pending" definitions can never diverge from the rest of the app. Rejected: re-implementing the predicates (drift).
- **ADR-4 — No `caja-math.ts` change.** Finding: `groupPendingByOwner` is already a public export. Supersedes the proposal's re-export task and eliminates its main risk.
- **ADR-5 — Dashboard not `adminOnly`; rely on RLS.** Chosen: everyone lands on `/admin/dashboard`; settlement data is RLS-scoped (admin-only), so non-admins see empty settlement metrics safely. Rejected: gating the whole route to admins (would block the index redirect for non-admin portal users).
- **ADR-6 — Presentational card owns no branching.** Loading/error/empty live in `DashboardPage` (matches caja). `DashboardStatCard` receives resolved numbers only.

## Risks / Open Questions Carried Forward

- **30-day sealed window** is a hardcoded `RECENT_SEALED_WINDOW_DAYS` constant. Open question from the proposal stands; isolating it as a named constant makes a future change trivial.
- **`amount` / `currency` field names** on `owner_settlements` rows are assumed from `SettlementLike` and the historial tab usage; the `tasks` phase should confirm against `database.ts` types when wiring `recentSealed` (sealed rows use the row's own `amount`/`currency`, not the breakdown).
- **`useMemo` deps include `loading`/`error`** so the returned object reference updates when those flip; acceptable, the body is cheap.
