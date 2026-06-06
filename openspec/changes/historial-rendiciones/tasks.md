# Tasks: historial-rendiciones

> Leg 3 — history tab for sealed rendiciones.
> Single PR. Strict TDD active (write failing test first, then implement).
> No DB migration, no RLS changes.

---

## Dependency graph

```
T-01 (types + helper impl)
  └─> T-02 (helper tests — red→green confirms T-01)
        └─> T-03 (useSettledSettlements hook + hook tests)
              └─> T-04 (SealedSettlementActions relocation)
                    └─> T-05 (HistorialTab component + render tests)
                          └─> T-06 (CajaPage wiring + cleanup)
                                └─> T-07 (caja-page.test.tsx update)
```

T-04 depends only on T-01 (types) so it can start in parallel with T-03 once T-02 is green.

---

## Tasks

### T-01 — Extend `caja-math.ts`: add `SealedGroup` + `groupSealedBySettlementGroup`

**Action**: edit
**File**: `src/features/caja/lib/caja-math.ts`
**Satisfies**: REQ-02, REQ-03, S-01, S-02, S-05
**Estimated lines added**: ~55

What to do:
- Add the `SealedBreakdown` import (or re-export) from `settlement-statement-data.ts` if it is not already importable from `caja-math`.
- Export the `SealedGroup` interface (fields: `settlement_group`, `owner_id`, `owner_name`, `currency`, `breakdown: SealedBreakdown`, `settled_date`, `cobro_count`).
- Export `groupSealedBySettlementGroup(settlements: SettlementWithOwner[]): SealedGroup[]` with exactly three guards in this order:
  1. `s.status !== "settled"` → skip
  2. `!s.breakdown` → skip (null-breakdown guard — MUST NOT be removed)
  3. `!s.settlement_group` → skip
- First row per `settlement_group` key wins; subsequent rows with the same key are skipped.
- `cobro_count` reads from `breakdown.cobro_count ?? 0`.
- Do NOT remove `groupPendingByOwner`, `computeBalance`, `computeTotals`, `computeSettlementBreakdown` — they stay.
- Do NOT delete the old `groupSealedByOwner` from `caja-page.tsx` yet (done in T-06).

Completion signal: TypeScript compiles with no errors on this file.

---

### T-02 — Pure helper tests for `groupSealedBySettlementGroup`

**Action**: edit (extend existing describe blocks)
**File**: `src/features/caja/__tests__/caja-math.test.ts`
**Satisfies**: REQ-02, REQ-03, S-01, S-02, S-05
**Estimated lines added**: ~70

Write a new `describe("groupSealedBySettlementGroup", ...)` block. Write tests BEFORE verifying green (strict TDD). Required cases:

1. **Two settlements, same owner, different `settlement_group`** → returns 2 groups. Both `settlement_group` UUIDs present in output (regression: history no longer collapses same-owner entries).
2. **Multiple rows, same `settlement_group`** → returns 1 group with the first row's breakdown.
3. **Null-breakdown row** → skipped; no throw; not present in output.
4. **Null `settlement_group` row** → skipped.
5. **`pending` row** → skipped (guard 1).
6. **Ordering**: input rows ordered `settled_date DESC` → output groups preserve newest-first.
7. **`cobro_count`** sourced from `breakdown.cobro_count`; defaults to `0` when field is absent.

Each test must be red before T-01 adds the implementation, then green after.

Completion signal: `vitest run src/features/caja/__tests__/caja-math.test.ts` — all tests pass, no regressions on existing blocks.

---

### T-03 — New hook `useSettledSettlements`

**Action**: new file
**File**: `src/features/caja/hooks/use-settled-settlements.ts`
**Satisfies**: REQ-01, REQ-09, S-05, S-08
**Estimated lines**: ~45

What to do:
- Export `SETTLED_SETTLEMENTS_QUERY_KEY = ["nodo_inmo", "owner_settlements", "settled"] as const` — distinct from `OWNER_SETTLEMENTS_QUERY_KEY` to guarantee independent cache.
- Export interface `UseSettledSettlementsResult { groups: SealedGroup[]; isLoading: boolean; isError: boolean }`.
- Export `useSettledSettlements(): UseSettledSettlementsResult`.
- `queryFn` runs:
  ```ts
  supabase
    .schema("nodo_inmo")
    .from("owner_settlements")
    .select("*, owner:contacts!owner_settlements_owner_id_fkey(name)")
    .eq("status", "settled")
    .order("settled_date", { ascending: false })
    .limit(50)
  ```
- Apply `groupSealedBySettlementGroup(data ?? [])` as the selector/transform inside `queryFn`. Return `SealedGroup[]`.
- Map TanStack result: `{ groups: data ?? [], isLoading, isError }`.
- `SealedGroup` and `groupSealedBySettlementGroup` imported from `caja-math.ts`.

Completion signal: TypeScript compiles; `useSettledSettlements` is importable with correct return type.

> Note: no integration test for the hook itself (mocked at component level in T-05). The grouping logic is already covered at the pure-function level in T-02.

---

### T-04 — Relocate `SealedSettlementActions` to its own file

**Action**: new file + edit source
**Files**:
  - `src/features/caja/components/sealed-settlement-actions.tsx` (new)
  - `src/features/caja/components/caja-page.tsx` (edit — remove the inline definition, add import)
**Satisfies**: REQ-07, design D5
**Estimated lines**: ~50 new (copy), ~5 diff on caja-page

What to do:
- Create `sealed-settlement-actions.tsx`. Copy the `SealedSettlementActions` function verbatim from `caja-page.tsx`. Update its `SealedGroup` import to come from `caja-math.ts` (the new canonical location added in T-01).
- Keep all internal logic unchanged: `useOrgProfile`, `useLogoUrl`, `canShare`, `buildData`, `handleDownload`, `handleShare`.
- In `caja-page.tsx`: remove the inline `SealedSettlementActions` definition and add `import { SealedSettlementActions } from "./sealed-settlement-actions"`.
- The `SealedGroup` interface defined inline in `caja-page.tsx` (`interface SealedGroup { owner_id ... }`) should also be removed since it is now in `caja-math.ts`; update the import.

Completion signal: TypeScript compiles on both files; existing `caja-page.test.tsx` still passes.

---

### T-05 — New `HistorialTab` component + render tests

**Action**: new files
**Files**:
  - `src/features/caja/components/historial-tab.tsx` (new)
  - `src/features/caja/components/__tests__/historial-tab.test.tsx` (new)
**Satisfies**: REQ-04, REQ-05, REQ-06, REQ-07, REQ-10, S-03, S-04, S-07
**Estimated lines**: ~120 component, ~110 tests

#### Tests first (strict TDD):

Write `historial-tab.test.tsx` before implementing the component. Required test cases:

Mock setup:
```ts
const mockUseSettledSettlements = vi.fn();
vi.mock("@/features/caja/hooks/use-settled-settlements", () => ({
  useSettledSettlements: () => mockUseSettledSettlements(),
  SETTLED_SETTLEMENTS_QUERY_KEY: ["nodo_inmo", "owner_settlements", "settled"],
}));
// Mock SealedSettlementActions to avoid PDF/profile wiring:
vi.mock("@/features/caja/components/sealed-settlement-actions", () => ({
  SealedSettlementActions: () => null,
}));
```

Fixture: two `SealedGroup`s for owner "Juan" (same owner, different `settlement_group` UUIDs), one with deductions and one without. Full valid `breakdown` on each.

Test cases:
1. **Both rows render** — "Juan" appears twice, both `breakdown.net` values visible. (Regression guarantee at component level — REQ-02, S-01.)
2. **Expand reveals breakdown** — click a row's expander → `gross`, `commission`, each deduction `description`, `deduction_total`, and `net` are in the document; the non-expanded row does NOT show its breakdown panel. (REQ-06, S-03.)
3. **Single-expanded accordion** — expand row A, then expand row B → row A panel closes, row B panel opens. Only one panel visible at a time. (Design D8.)
4. **No-deductions group** — expanded panel omits the deductions block but still shows net. (REQ-06 edge case.)
5. **Empty state** — `groups: []` → text "No hay rendiciones liquidadas aún" (or the canonical empty-state copy). (REQ-10, S-07.)
6. **Loading state** — `isLoading: true` → element with `role="status"` present. (REQ-10.)
7. **Error state** — `isError: true` → element with `role="alert"` present. (REQ-10.)

#### Component implementation (after tests are red):

`historial-tab.tsx`:
- No props. Calls `useSettledSettlements()` internally.
- State: `const [expandedId, setExpandedId] = useState<string | null>(null)`.
- Renders loading/error/empty states before the table (mirror `SettlementsTab` pattern).
- Table columns: Propietario, Fecha, Moneda, Cobros, Neto, expander button.
- Expander button: `aria-expanded={expandedId === g.settlement_group}`, `aria-controls="panel-{g.settlement_group}"`.
- Expanded panel: second `<TableRow>` spanning all columns, shown only when `expandedId === g.settlement_group` (use ternary, not `&&`). Reads `g.breakdown.*` verbatim — no recompute. Lines: gross, commission (with rate), owner_share, deductions block (conditional on length > 0), deduction_total, net. Ends with `<SealedSettlementActions group={g} />`.
- `formatMoney` and `formatDate` from `@/features/contracts/lib/contract-labels`.

Completion signal: `vitest run src/features/caja/components/__tests__/historial-tab.test.tsx` — all 7 tests pass.

---

### T-06 — Wire `HistorialTab` into `CajaPage` + remove "realizadas" section from `SettlementsTab`

**Action**: edit
**File**: `src/features/caja/components/caja-page.tsx`
**Satisfies**: REQ-04, REQ-08, S-06
**Estimated lines changed**: ~25 net (additions + deletions)

What to do in `caja-page.tsx`:

1. **Tab union**: change `type Tab = "movimientos" | "liquidaciones"` → `type Tab = "movimientos" | "liquidaciones" | "historial"`.
2. **Third tab button**: add `<TabButton active={tab === "historial"} onClick={() => setTab("historial")}>Historial</TabButton>` after Liquidaciones.
3. **Tab render**: replace the two-branch ternary with an explicit three-branch conditional:
   ```tsx
   {tab === "movimientos" && <MovementsTab />}
   {tab === "liquidaciones" && <SettlementsTab />}
   {tab === "historial" && <HistorialTab />}
   ```
4. **Import `HistorialTab`** from `./historial-tab`.
5. **Remove from `SettlementsTab`**:
   - The `sealedGroups = groupSealedByOwner(allSettlements)` line.
   - The `hasSealed` variable.
   - The entire `{!isLoading && !isError && hasSealed && (...)}` "Liquidaciones realizadas" JSX block (~30 lines).
   - Change the empty-state condition from `!hasPending && !hasSealed` to `!hasPending`.
6. **Remove now-dead code** from `caja-page.tsx`:
   - The `groupSealedByOwner` function definition (inline — now replaced by the canonical one in `caja-math.ts`).
   - The inline `interface SealedGroup` (superseded by `caja-math.ts` export).
   - Any leftover `SealedSettlementActions` definition if not already removed in T-04.

Completion signal: TypeScript compiles; no dead code warnings; `SettlementsTab` no longer references `sealedGroups` or `hasSealed`.

---

### T-07 — Update `caja-page.test.tsx`: assert Historial tab exists + settled section gone

**Action**: edit
**File**: `src/features/caja/__tests__/caja-page.test.tsx`
**Satisfies**: REQ-04, REQ-08, S-06
**Estimated lines added**: ~20

Add mock for the new hook (to prevent real queries from firing in the test):
```ts
const mockUseSettledSettlements = vi.fn();
vi.mock("@/features/caja/hooks/use-settled-settlements", () => ({
  useSettledSettlements: () => mockUseSettledSettlements(),
  SETTLED_SETTLEMENTS_QUERY_KEY: ["nodo_inmo", "owner_settlements", "settled"],
}));
```
Set default return in `beforeEach`: `mockUseSettledSettlements.mockReturnValue({ groups: [], isLoading: false, isError: false })`.

New test cases:
1. **Historial tab button exists** — `screen.getByRole("button", { name: "Historial" })` is in the document.
2. **Liquidaciones tab has no "realizadas" section** — navigate to Liquidaciones tab with settled settlements in `useOwnerSettlements` data; assert `screen.queryByText(/liquidaciones realizadas/i)` is `null`.

Existing tests must pass unchanged (they only assert pending content, which is unaffected).

Completion signal: `vitest run src/features/caja/__tests__/caja-page.test.tsx` — all tests pass including the 2 new ones.

---

## Execution order

| Step | Task | Depends on | Parallel-safe? |
|------|------|-----------|----------------|
| 1 | T-01 (helper impl) | — | start here |
| 2 | T-02 (helper tests) | T-01 | immediately after T-01 |
| 3a | T-03 (hook) | T-01 + T-02 green | after T-02 |
| 3b | T-04 (actions relocation) | T-01 (types) | parallel with T-03 |
| 4 | T-05 (HistorialTab + tests) | T-03 + T-04 | after both 3a and 3b |
| 5 | T-06 (CajaPage wiring + cleanup) | T-05 | after T-05 |
| 6 | T-07 (caja-page.test update) | T-06 | after T-06 |

T-03 and T-04 are the only parallel pair. Everything else is strictly sequential.

---

## Review workload forecast

| Metric | Estimate |
|--------|----------|
| New files | 4 (`use-settled-settlements.ts`, `sealed-settlement-actions.tsx`, `historial-tab.tsx`, `historial-tab.test.tsx`) |
| Edited files | 4 (`caja-math.ts`, `caja-page.tsx`, `caja-math.test.ts`, `caja-page.test.tsx`) |
| Lines added (net) | ~180–230 |
| Lines deleted (net) | ~50–70 (realizadas block + inline types + inline helper) |
| Total diff estimate | ~250–300 lines |
| Chained PRs recommended | No — single PR, within 400-line budget |
| 400-line budget risk | Low |
| Delivery strategy | single-pr |
| Chain strategy | pending |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

---

## Risk register (from design)

| Risk | Mitigation in tasks |
|------|---------------------|
| R1 — Regroup regression (same-owner collapses) | T-02 test case 1 is the explicit regression guard; T-07 asserts "realizadas" section is gone |
| R2 — Dropped null-breakdown guard | T-02 test case 3 forces the guard to be present; listed as guard #2 in T-01 spec |
| R3 — `.limit(50)` undercounts groups (multi-cobro) | Accepted MVP risk, no task added; flagged for leg 4 |
| R4 — Tab/data coupling | T-07 mock isolation + T-03 distinct query key |
| R5 — Re-share recomputes breakdown | T-05 test case 2 verifies `SealedSettlementActions` receives stored `g.breakdown` |
