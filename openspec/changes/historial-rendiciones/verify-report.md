# Verify Report: historial-rendiciones

**Change**: historial-rendiciones
**Date**: 2026-06-06
**Mode**: openspec
**Verdict**: PASS WITH WARNINGS

---

## Build & Test Evidence

| Command | Result |
|---------|--------|
| `npm test -- --run` | 36 test files, **248 tests, all green** |
| `npm run build` | TypeScript clean, Vite build succeeds. Large chunk warning is pre-existing from `@react-pdf/renderer` (not introduced by this change). |

---

## Task Completeness

| Task | Status |
|------|--------|
| T-01 — `caja-math.ts`: `SealedGroup` + `groupSealedBySettlementGroup` | COMPLETE |
| T-02 — `caja-math.test.ts`: 9 helper tests | COMPLETE (9/9 pass) |
| T-03 — `use-settled-settlements.ts` hook | COMPLETE |
| T-04 — `SealedSettlementActions` relocation | COMPLETE |
| T-05 — `historial-tab.tsx` + 7 render tests | COMPLETE (7/7 pass) |
| T-06 — `CajaPage` wiring + "realizadas" removal | COMPLETE |
| T-07 — `caja-page.test.tsx` update | COMPLETE (6/6 pass) |
| Additional — `settlement-statement.test.tsx` migration | COMPLETE (16/16 pass) |

All 7 planned tasks are marked complete and confirmed by passing tests.

---

## Spec Compliance Matrix

| Req | Description | Status | Evidence |
|-----|-------------|--------|----------|
| REQ-01 | `status='settled'`, `settled_date DESC`, `limit 50` | PASS | `use-settled-settlements.ts:38-43` — exact query match |
| REQ-02 | One entry per `settlement_group` UUID | PASS | `groupSealedBySettlementGroup` keys on `s.settlement_group`; caja-math.test.ts test 1 asserts 2 groups for same owner |
| REQ-03 | Null-breakdown rows skipped silently | PASS | Guard 2 at `caja-math.ts:133`; caja-math.test.ts test 3 asserts no throw + not in output |
| REQ-04 | Historial tab in CajaPage | PASS | `caja-page.tsx:27,52-64`; caja-page.test.tsx "Historial tab button exists" |
| REQ-05 | Collapsed row shows owner, currency, date, net, cobro_count | PASS | `historial-tab.tsx:119-125` — all 5 fields present |
| REQ-06 | Expanded row shows full breakdown | PASS* | `historial-tab.tsx:166-213` — gross, commission+rate, owner_share, deductions[], deduction_total, net. *See SUGGESTION-1 |
| REQ-07 | Re-share reads stored breakdown, no recompute | PASS | `sealed-settlement-actions.tsx:30-36` passes `group.breakdown` verbatim to `buildStatementData` |
| REQ-08 | Liquidaciones tab has no "realizadas" section | PASS | `caja-page.tsx:241-329` — no `sealedGroups`/`hasSealed` references; caja-page.test.tsx asserts absence |
| REQ-09 | Independent data fetch for Historial tab | PASS | Distinct query key `["nodo_inmo","owner_settlements","settled"]` vs `["nodo_inmo","owner_settlements"]` |
| REQ-10 | Empty state handled | PASS | `historial-tab.tsx:57-68` renders "No hay rendiciones liquidadas aún" |

### Scenario Compliance

| Scenario | Status | Test Coverage |
|----------|--------|---------------|
| S-01 — Two settlements same owner, both appear | PASS | caja-math.test.ts test 1 (helper); historial-tab.test.tsx test 1 (component) |
| S-02 — Null-breakdown row skipped | PASS | caja-math.test.ts test 3 |
| S-03 — Expanding row shows full breakdown | PASS | historial-tab.test.tsx test 2 |
| S-04 — Re-share produces original comprobante | PASS | `sealed_at` and all breakdown fields flow through `group.breakdown` verbatim |
| S-05 — Query: settled only, newest first, bounded at 50 | PASS | use-settled-settlements.ts query + caja-math.test.ts test 6 (ordering) |
| S-06 — Liquidaciones tab no longer lists past settlements | PASS | caja-page.test.tsx "no realizadas section" |
| S-07 — Empty state for no settled settlements | PASS | historial-tab.test.tsx test 5 |
| S-08 — Historial tab data independent of other tabs | PASS | distinct query key; HistorialTab self-fetches only on mount |

---

## Design Coherence

| Decision | Implemented? | Notes |
|----------|-------------|-------|
| D1 — Group by `settlement_group` UUID | YES | |
| D2 — New hook with distinct query key | YES | |
| D3 — Grouping inside `queryFn` | YES | |
| D4 — Helper + `SealedGroup` in `caja-math.ts` | YES | |
| D5 — `SealedSettlementActions` in own file | YES | |
| D6 — "Liquidaciones realizadas" removed outright | YES | |
| D7 — `cobro_count` from `breakdown.cobro_count` | YES | |
| D8 — Single `expandedId` accordion state | YES | |
| D9 — `.limit(50)` on rows, no pagination | YES | |
| D10 — No DB migration / no new RLS | YES | |

---

## Issues

### WARNING

**W-01 — `useSettleOwner` does not invalidate `SETTLED_SETTLEMENTS_QUERY_KEY` after liquidation**

Location: `src/features/caja/hooks/use-settle-owner.ts:47`

`onSuccess` only calls `queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY })`. After a new liquidation, the Historial tab's TanStack cache is stale until the user remounts the tab (navigates away and back). The settlement will not appear in Historial until manual refresh or next mount.

This is not a spec violation (REQ-09 requires independence, not that mutation events propagate). However, the UX creates a silent stale view: a user who liquidates and then immediately clicks Historial will see the old list. The fix is a one-line addition to `onSuccess`:

```ts
queryClient.invalidateQueries({ queryKey: SETTLED_SETTLEMENTS_QUERY_KEY });
```

Severity: WARNING (user-visible staleness; no data loss; workaround is tab switch).

---

### SUGGESTION

**SUGGESTION-1 — `deduction_total` not shown when `deductions.length === 0`**

REQ-06 says the expanded row MUST show `deduction_total`. The implementation (per design D section 3.3) omits the entire deductions block including `deduction_total` when there are no deductions. Since `deduction_total = 0` in those cases, this is mathematically correct but technically diverges from the strict spec wording.

The design doc explicitly permits this omission ("If `deductions.length === 0`, omit the 'Deducciones' block entirely"). Treat as a design-level spec interpretation, not a bug.

If strict REQ-06 compliance is desired, add `deduction_total: $0` as a summary line even when no deductions exist.

---

**SUGGESTION-2 — `HistorialTab` test for `SealedSettlementActions` invocation with stored `group`**

historial-tab.test.tsx mocks `SealedSettlementActions` to `() => null` but does not assert that it receives `group` with the correct `breakdown` (S-04 at component level). The scenario is integration-tested via `settlement-statement.test.tsx`, but a focused assertion on `data-testid="actions-{settlement_group}"` would pin the prop contract. Low priority since the mock already renders the testid.

---

## Final Verdict

**PASS WITH WARNINGS**

1 WARNING (W-01: stale Historial cache after new liquidation), 2 SUGGESTIONS (spec wording vs design interpretation on deduction_total; missing prop assertion in component test).

No CRITICAL issues. All spec requirements are met. All 248 tests pass. Build is clean. Safe to proceed to `sdd-archive`.
