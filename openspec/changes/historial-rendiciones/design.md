# Design: historial-rendiciones

> Leg 3 of the rendiciones roadmap. A **read-and-display** change: a new `Historial`
> tab on `CajaPage` that lists every sealed rendición (newest first, bounded to 50),
> lets the admin expand a row to read the frozen `breakdown`, and re-share/re-download
> the exact comprobante leg 2 sealed. No DB migration, no new RLS, no new PDF code.

## 1. Architecture approach

### Pattern and layering

This change adds **one read surface** and stays inside the existing
feature-sliced layering of `src/features/caja`:

```
hooks/    use-settled-settlements.ts   (new)  — bounded data fetch (TanStack Query)
lib/      caja-math? / caja-page local helper — grouping helper (regroup)
components/ caja-page.tsx               (edit) — tab union + wiring + cleanup
          historial-tab.tsx            (new)  — presentational history surface
```

Key boundary decisions:

- **Data fetch lives in a dedicated hook** (`useSettledSettlements`), not in the
  component, mirroring `useOwnerSettlements`/`useCashMovements`. The hook is the only
  place that knows the Supabase query shape; the tab is purely presentational over
  `{ groups }`.
- **The grouping helper is moved out of component body into the hook's queryFn
  selector** so the hook returns already-grouped `SealedGroup[]`. The presentational
  component never sees raw rows. This is the cleanest seam: the regroup bug fix lives
  in exactly one testable place, and `historial-tab.tsx` renders pre-grouped data.
- **`SealedSettlementActions` is hoisted** out of `caja-page.tsx` so both the (to be
  removed) Liquidaciones path and the new Historial tab can consume it. It is moved
  to its own module to break the implicit coupling to the Liquidaciones tab.

### Why a separate hook (not extend `useOwnerSettlements`)

`useOwnerSettlements` fetches **pending + settled together** with
`order("created_at")` and **no limit** — it is the action surface for the
Liquidaciones tab. Historial needs a **purpose-built bounded query**
(`status='settled'`, `order settled_date DESC`, `limit 50`). Bolting a second
concern onto the existing hook would (a) change the Liquidaciones query, and (b)
re-fetch unbounded data the history tab does not need. Two hooks, two jobs.
This also satisfies risk #4 (tab/data coupling): switching to Historial fires its
own independent query and never perturbs Movimientos/Liquidaciones cache entries.

## 2. Component & data-flow map

```
CajaPage (tab state: "movimientos" | "liquidaciones" | "historial")
 ├─ MovementsTab        (unchanged)
 ├─ SettlementsTab      (cleanup: pending-only)
 └─ HistorialTab        (new)
      └─ useSettledSettlements() ──► supabase.select(...).eq('status','settled')
                                       .order('settled_date', desc).limit(50)
                                       │
                                       └─ select/transform: groupSealedBySettlementGroup(rows)
                                            → { groups: SealedGroup[] }
      └─ renders table; each row expandable
           └─ expanded panel: breakdown lines (gross, commission, deductions[], net)
           └─ SealedSettlementActions { group }  (reused, unchanged contract)
```

Data flows **one way**: hook → `{ groups }` → table rows → expanded panel +
`SealedSettlementActions`. No row recomputes anything; every figure is read
verbatim from the frozen `breakdown` JSONB.

## 3. Concrete technical decisions

### 3.1 `useSettledSettlements` hook

New file: `src/features/caja/hooks/use-settled-settlements.ts`.

**Query** (Supabase, `nodo_inmo` schema):

```ts
const { data, error } = await supabase
  .schema("nodo_inmo")
  .from("owner_settlements")
  .select("*, owner:contacts!owner_settlements_owner_id_fkey(name)")
  .eq("status", "settled")
  .order("settled_date", { ascending: false })
  .limit(50);
```

- **Select**: same `*` + embedded owner name as `useOwnerSettlements` (reuses the
  existing FK embed alias `owner:contacts!owner_settlements_owner_id_fkey(name)`).
  `*` already includes `breakdown`, `settlement_group`, `settled_date`, `currency`,
  `owner_id`, `status`.
- **Filter**: `.eq("status", "settled")` — only sealed rows. RLS (Template B,
  org-scoped + admin) already restricts to the caller's org; no extra predicate.
- **Order**: `settled_date DESC` — newest first. (Per-row tie order within the same
  settlement is irrelevant; we group by `settlement_group`.)
- **Limit**: `.limit(50)` — bounded MVP, no pagination. Note: the limit is on **rows**,
  not groups; a multi-cobro liquidación occupies several rows. This is acceptable for
  the MVP — see Risk R3 below for the mitigation/flag.

**Return type & shape**:

```ts
export interface UseSettledSettlementsResult {
  groups: SealedGroup[];   // already grouped + ordered newest-first
  isLoading: boolean;
  isError: boolean;
}

export function useSettledSettlements(): UseSettledSettlementsResult
```

Internally a `useQuery<SealedGroup[]>` whose `queryFn` runs the query and returns
`groupSealedBySettlementGroup(rows)`. The hook maps TanStack's
`{ data, isLoading, isError }` to `{ groups: data ?? [], isLoading, isError }` so the
component never touches `data ?? []` plumbing.

- **Query key**: `["nodo_inmo", "owner_settlements", "settled"]` — a **distinct key**
  from `OWNER_SETTLEMENTS_QUERY_KEY` so the two hooks have independent cache entries
  (no accidental cross-invalidation). Export as `SETTLED_SETTLEMENTS_QUERY_KEY`.
- **Loading/error**: standard TanStack flags surfaced verbatim; the tab renders the
  same spinner/alert pattern already used in `SettlementsTab`.
- **Grouping**: done **inside `queryFn`** (selector-style), so the component receives
  grouped data and the grouping logic is unit-testable as a pure function.

> Decision: grouping in the hook (not in the component). Rationale: keeps the bug fix
> in one place, makes `historial-tab.tsx` a thin presentational component, and lets the
> grouping helper be tested in isolation. Rejected: grouping inside the component
> (current pattern) — that is exactly what entangled the broken helper with the
> Liquidaciones tab.

### 3.2 `groupSealedByOwner` → `groupSealedBySettlementGroup` refactor

The helper is **renamed and re-keyed**, and **moved** to a shared location so both the
hook and tests import it. Target: `src/features/caja/lib/caja-math.ts` (it already
owns `groupPendingByOwner` and the `SealedBreakdown` consumers live nearby) — keeping
all grouping helpers in one pure-function module. The `SealedGroup` interface moves
there too and is exported.

**New key**: `settlement_group` (UUID, nullable in schema → guarded).

```ts
export interface SealedGroup {
  settlement_group: string;     // NEW: the grouping key, surfaced for React key + dedupe
  owner_id: string;
  owner_name: string;
  currency: string;
  breakdown: SealedBreakdown;
  settled_date: string;
  cobro_count: number;          // NEW: surfaced from breakdown.cobro_count (default 0)
}

export function groupSealedBySettlementGroup(
  settlements: SettlementWithOwner[],
): SealedGroup[] {
  const map = new Map<string, SealedGroup>();

  for (const s of settlements) {
    if (s.status !== "settled") continue;     // guard 1: only sealed
    if (!s.breakdown) continue;               // guard 2: null-breakdown skip (PRESERVED)
    if (!s.settlement_group) continue;        // guard 3: cannot key a null group

    const key = s.settlement_group;
    if (map.has(key)) continue;               // first row wins; all rows in a group share the breakdown

    const breakdown = s.breakdown as unknown as SealedBreakdown;
    map.set(key, {
      settlement_group: key,
      owner_id: s.owner_id,
      owner_name: s.owner?.name ?? "—",
      currency: s.currency,
      breakdown,
      settled_date: s.settled_date ?? "",
      cobro_count: breakdown.cobro_count ?? 0,
    });
  }

  return Array.from(map.values());
}
```

**Guard locations** (ordered, all kept):

1. `s.status !== "settled"` — defensive even though the hook already filters
   (so the pure helper is correct in isolation and reusable for in-memory tests).
2. `!s.breakdown` — the **load-bearing null-breakdown skip** carried from leg 2.
   Risk #2: this MUST survive the rename. Explicitly the second guard.
3. `!s.settlement_group` — new: a legacy sealed row that predates the
   `settlement_group` stamp cannot be keyed; skip it rather than collapse all
   null-group rows under a single `"null"` bucket.

**Ordering**: the hook's query already returns rows `settled_date DESC`. Because the
`Map` preserves first-insertion order and we keep the **first** row per group, the
resulting `SealedGroup[]` is already newest-first. No re-sort needed in the helper.

> Decision: `cobro_count` comes from `breakdown.cobro_count`, not a `COUNT(*)` over
> rows. Rationale: the breakdown is the frozen point-in-time fact (leg-2 invariant) and
> already stores `cobro_count`; deriving it from live row count would be a recompute.
> Default `?? 0` guards pre-leg-2 snapshots that omit the field.

### 3.3 `HistorialTab` component

New file: `src/features/caja/components/historial-tab.tsx`.

- **Props**: none. It calls `useSettledSettlements()` itself (same self-fetching
  pattern as `MovementsTab`/`SettlementsTab`). This keeps `CajaPage` a thin tab router.
- **State**: a single `expandedId: string | null` (the `settlement_group` of the open
  row), via `useState<string | null>(null)`. Single-expanded model (accordion), not
  per-row booleans — simpler, only one breakdown panel open at a time, and avoids an
  unbounded state map. Toggling the same id closes it.

**Table columns** (collapsed/headline row):

| Column        | Source                                | Align  |
|---------------|---------------------------------------|--------|
| Propietario   | `g.owner_name`                        | left   |
| Fecha         | `formatDate(g.settled_date)`          | left   |
| Moneda        | `g.currency`                          | left   |
| Cobros        | `g.cobro_count`                       | right  |
| Neto          | `formatMoney(g.breakdown.net, currency)` | right |
| (expander)    | chevron button — toggles `expandedId` | right  |

The whole row (or a dedicated chevron cell with `aria-expanded`) toggles expansion.
Use an accessible button with `aria-expanded={expandedId === g.settlement_group}` and
`aria-controls` pointing at the panel id, so the expand affordance is keyboard- and
screen-reader-reachable.

**Expanded panel** (rendered as a second `<TableRow>` spanning all columns, shown only
when `expandedId === g.settlement_group`):

Reads the frozen breakdown verbatim — **no recompute** (`rendering-conditional-render`:
use a ternary, not `&&`, for the conditional row). Lines:

```
Bruto (gross)                                   formatMoney(b.gross, currency)
Comisión (b.commission_rate %)                 − formatMoney(b.commission, currency)
Subtotal propietario (owner_share)              formatMoney(b.owner_share, currency)
Deducciones:                                    (header — only if deductions.length > 0)
  • {d.description} · {formatDate(d.expense_date)}  − formatMoney(d.amount, currency)
  ...one line per d in b.deductions
Total deducciones (deduction_total)            − formatMoney(b.deduction_total, currency)
Neto liquidado (net)                            formatMoney(b.net, currency)
Comprobante:                                    <SealedSettlementActions group={g} />
```

- **Deduction lines**: iterate `g.breakdown.deductions` (typed `BreakdownDeduction[]`),
  keyed by `d.id`. Render description, `formatDate(d.expense_date)`, and the amount.
  If `deductions.length === 0`, omit the "Deducciones" block entirely (still show net).
- **No null-breakdown branch in the panel**: groups reaching the table are already
  guaranteed to have a non-null breakdown (guard 2 in the helper), so the panel can
  read `g.breakdown.*` without re-guarding. The skip happens upstream.

**Empty / loading / error states**: mirror `SettlementsTab` exactly —
`role="status"` spinner while `isLoading`, `role="alert"` box on `isError`, and a
dashed empty-state card ("Todavía no hay liquidaciones realizadas") when
`groups.length === 0`.

### 3.4 `CajaPage` changes

```ts
type Tab = "movimientos" | "liquidaciones" | "historial";
```

- Add a third `TabButton` ("Historial") after "Liquidaciones".
- Replace the single ternary with a small switch/ternary chain rendering
  `MovementsTab` / `SettlementsTab` / `HistorialTab`. (`rendering-conditional-render`
  applies; keep it explicit.)
- `HistorialTab` is wired by **mounting it** when `tab === "historial"`. It
  self-fetches via `useSettledSettlements`, so `CajaPage` passes no props. The query
  only fires when the tab mounts (independent bounded fetch — satisfies risk #4).

**Liquidaciones "realizadas" section — REMOVE OUTRIGHT.**

> Decision: remove the "Liquidaciones realizadas" block from `SettlementsTab`, not keep
> it as a last-settlement summary. Rationale: (a) the proposal's spine is that history
> belongs in its own tab; leaving a parallel summary re-introduces two surfaces over the
> same data and a second caller of a grouping helper (risk #1: a leftover caller depending
> on the old collapsing behavior). (b) A "last settlement only" widget would still need a
> grouping/sort decision and is not in scope. (c) Removing it shrinks the diff and makes
> `SettlementsTab` single-purpose (pending only). Rejected: keep-as-summary — adds a second
> consumer of the regrouped data with no scoped requirement and re-opens the coupling risk.

Concretely in `SettlementsTab`:

- Delete the `sealedGroups = groupSealedByOwner(allSettlements)` line and the entire
  `{hasSealed && (...)}` "Liquidaciones realizadas" JSX block.
- The empty-state condition simplifies from `!hasPending && !hasSealed` to
  `!hasPending`.
- `useOwnerSettlements` stays as-is (still fetches pending+settled; we just stop
  rendering the settled half here). Not narrowing the query avoids touching the
  pending flow in this leg.

### 3.5 `SealedSettlementActions` reuse

**No contract change.** Its single prop is `{ group: SealedGroup }` and it only reads
`group.breakdown`, `group.owner_name`, `group.settled_date`. As long as
`HistorialTab` passes a `SealedGroup` (which it does, from the hook), it works
unchanged. The added `settlement_group` and `cobro_count` fields on `SealedGroup` are
additive and ignored by the actions component.

**Move it** out of `caja-page.tsx` into its own module
`src/features/caja/components/sealed-settlement-actions.tsx` and export it, so:

- `HistorialTab` imports it without importing the whole `caja-page` module.
- After the Liquidaciones "realizadas" removal, `caja-page.tsx` no longer references
  it — keeping it inside `caja-page.tsx` would leave dead-looking code.

This is a pure relocation (no logic change): same `useOrgProfile`, `useLogoUrl`,
`canShare`, `buildData`, `handleDownload`, `handleShare`. The `SealedGroup` type it
consumes now comes from `caja-math.ts` (the new home of the interface).

> Decision: relocate `SealedSettlementActions` to its own file. Rationale: it becomes a
> cross-tab shared component; co-locating it with the (removed) Liquidaciones section is
> wrong after the cleanup. Rejected: leave in `caja-page.tsx` — creates an import cycle
> risk and couples `historial-tab` to the page module.

## 4. Test design

**File strategy**: keep existing `caja-page.test.tsx` for the
Movimientos/Liquidaciones-pending coverage (it must still pass after the
"realizadas" removal — drop any assertion that depended on the settled section if one
exists; current tests only assert pending, so they survive). Add a **new file**
`src/features/caja/components/__tests__/historial-tab.test.tsx` for the new surface,
plus pure-function tests for the helper.

### 4.1 Pure helper tests — `caja-math.test.ts` (extend existing or new block)

`groupSealedBySettlementGroup` is the spine; test it directly (fast, no render):

- **Two settlements, same owner, different `settlement_group`** → returns **2 groups**
  (the core regression fix: history no longer collapses). Assert both
  `settlement_group` values are present.
- **Multiple rows, same `settlement_group`** → returns **1 group** with the first
  row's breakdown (multi-cobro dedupe).
- **Null-breakdown row** (`breakdown: null`) → **skipped**, not present in output,
  no throw (risk #2).
- **Null `settlement_group` row** → skipped (guard 3).
- **`pending` row** → skipped (guard 1).
- **Ordering**: given input rows ordered `settled_date DESC`, output groups preserve
  newest-first.
- **`cobro_count`** sourced from `breakdown.cobro_count`; defaults to `0` when absent.

### 4.2 `HistorialTab` render tests

**Mock shape for `useSettledSettlements`** (it returns grouped data, so the mock
returns `{ groups, isLoading, isError }` directly — no need to mock Supabase):

```ts
const mockUseSettledSettlements = vi.fn();
vi.mock("@/features/caja/hooks/use-settled-settlements", () => ({
  useSettledSettlements: () => mockUseSettledSettlements(),
  SETTLED_SETTLEMENTS_QUERY_KEY: ["nodo_inmo", "owner_settlements", "settled"],
}));
```

Also mock `SealedSettlementActions` (or its dependency hooks `useOrgProfile`/
`useLogoUrl`) to avoid pulling PDF/profile wiring into the render test — follow the
existing `MovementFormDialog: () => null` pattern.

Fixture: two `SealedGroup`s for the **same owner** ("Juan"), different
`settlement_group`, with full breakdowns (one with deductions, one without).

**Key test cases**:

1. **Both settlements for the same owner render** — two history rows, "Juan" appears
   twice, each net visible. (The regression guarantee at the component level.)
2. **Expand reveals breakdown** — click a row's expander → `gross`, `commission`,
   each deduction `description`, `deduction_total`, and `net` are in the document;
   collapsed sibling does **not** show its breakdown.
3. **Single-expanded behavior** — expanding row B collapses row A (only one panel open).
4. **No-deductions group** — expanded panel omits the "Deducciones" block but still
   shows net.
5. **Empty state** — `groups: []` → "Todavía no hay liquidaciones realizadas".
6. **Loading / error** — `isLoading: true` → `role="status"`; `isError: true` →
   `role="alert"`.

> Null-breakdown is covered at the **helper** level (4.1), not here, because the
> component never receives a null-breakdown group (it is filtered upstream). Testing it
> at the helper is the correct, cheaper layer.

### 4.3 Strict TDD note

Strict TDD is active for this project. Order per unit: (1) write the failing helper
test for `groupSealedBySettlementGroup` (rename + 2-groups case) → see red →
implement; (2) failing `HistorialTab` render test → red → implement; (3) failing
`CajaPage` "Historial tab exists / settled section gone" test → red → wire tab.

## 5. ADR-style decisions

| # | Decision | Rationale | Rejected alternative |
|---|----------|-----------|----------------------|
| D1 | Group by `settlement_group` UUID | One liquidación = one history entry; fixes silent data loss | `owner_id:currency` (collapses to latest only) |
| D2 | New `useSettledSettlements` hook, distinct query key | Bounded purpose-built query; independent cache; doesn't perturb pending flow | Extend `useOwnerSettlements` (changes pending query, unbounded) |
| D3 | Group **inside** the hook's `queryFn` | Bug fix in one testable place; tab stays presentational | Group in the component (current pattern that caused the coupling) |
| D4 | Move helper + `SealedGroup` to `caja-math.ts` | Co-locate pure grouping fns; importable by hook + tests | Keep in `caja-page.tsx` (couples to page module) |
| D5 | Relocate `SealedSettlementActions` to own file | Cross-tab shared component after Liquidaciones cleanup | Leave in `caja-page.tsx` (dead-looking / cycle risk) |
| D6 | **Remove** "Liquidaciones realizadas" outright | History lives in its own tab; removes the second grouping caller (risk #1); shrinks diff | Keep as last-settlement summary (re-opens coupling, out of scope) |
| D7 | `cobro_count` from `breakdown.cobro_count` | Frozen fact, no recompute (leg-2 invariant) | `COUNT(*)` over live rows (recompute) |
| D8 | Single `expandedId` accordion state | One panel open, bounded state, simple | Per-row boolean map (unbounded, more bookkeeping) |
| D9 | `.limit(50)` on rows, no pagination | No pagination pattern exists; bounded newest-first is safe MVP | Infinite scroll / page controls (out of scope) |
| D10 | No DB migration / no new RLS | `owner_settlements` + Template B RLS already suffice | New index/policy (not a blocker at MVP volume) |

## 6. Risks & assumptions (carried into tasks/apply)

- **R1 — Regroup regression (highest).** Mitigated by doing the regroup AND the
  Liquidaciones "realizadas" removal in the same change (D6), so no caller depends on
  the old collapsing behavior. Covered by the "two groups, same owner" helper test.
- **R2 — Dropped null-breakdown guard.** The `if (!s.breakdown) continue` guard is
  explicitly the second guard in `groupSealedBySettlementGroup` and is unit-tested.
- **R3 — Row-limited `.limit(50)` undercounts groups.** Because the limit is on rows,
  a few multi-cobro liquidaciones reduce the number of distinct groups shown below 50.
  Acceptable for MVP. **Assumption to validate**: current data volume keeps this well
  under one screen. **Flagged future optimization** (not this leg): a composite index
  `(org_id, settled_date) WHERE status='settled'` and/or a server-side
  `distinct settlement_group` / RPC so the limit counts groups, not rows.
- **R4 — Tab/data coupling.** The new hook fetches independently with its own query
  key; mounting `HistorialTab` triggers only its bounded query. No shared cache entry
  with `useOwnerSettlements`.
- **R5 — Re-share parity.** Each history row passes its **stored** `g.breakdown` to
  `SealedSettlementActions` (never a re-derived one), so the reprint is byte-for-byte
  the leg-2 original by construction.

## 7. Files touched (for tasks phase)

| File | Action |
|------|--------|
| `src/features/caja/hooks/use-settled-settlements.ts` | **new** — bounded settled query + grouping |
| `src/features/caja/lib/caja-math.ts` | **edit** — add `SealedGroup` + `groupSealedBySettlementGroup` |
| `src/features/caja/components/sealed-settlement-actions.tsx` | **new** — relocated from caja-page |
| `src/features/caja/components/historial-tab.tsx` | **new** — history table + expandable breakdown |
| `src/features/caja/components/caja-page.tsx` | **edit** — Tab union, 3rd tab, remove "realizadas", drop inline helper + actions |
| `src/features/caja/lib/caja-math.test.ts` | **edit/new** — helper tests |
| `src/features/caja/components/__tests__/historial-tab.test.tsx` | **new** — render tests |
| `src/features/caja/__tests__/caja-page.test.tsx` | **edit** — keep pending tests; assert Historial tab + settled section gone |
