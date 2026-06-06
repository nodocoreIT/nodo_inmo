# Apply Progress: historial-rendiciones

## Status
All 7 tasks complete. 248/248 tests green. Build passes.

## Tasks

- [x] T-01 — Extended `caja-math.ts`: added `SealedBreakdown` re-export, `SettlementForGrouping` interface, `SealedGroup` interface, and `groupSealedBySettlementGroup` pure function with all three guards in the required order.
- [x] T-02 — Added `groupSealedBySettlementGroup` test block to `caja-math.test.ts` (9 new tests covering all specified cases: 2-group regression, dedup, null-breakdown guard, null settlement_group guard, pending-row guard, ordering, cobro_count default, empty input, single settlement).
- [x] T-03 — Created `use-settled-settlements.ts` hook with `SETTLED_SETTLEMENTS_QUERY_KEY`, `UseSettledSettlementsResult` interface, and `useSettledSettlements()` with bounded Supabase query (`status='settled'`, `order settled_date DESC`, `limit 50`), grouping inside `queryFn`.
- [x] T-04 — Relocated `SealedSettlementActions` to `sealed-settlement-actions.tsx`; updated `caja-page.tsx` to remove inline definition and all its dead imports.
- [x] T-05 — Created `historial-tab.tsx` (self-fetching, accordion expand, empty/loading/error states, `SealedSettlementActions` per expanded row) and `components/__tests__/historial-tab.test.tsx` (7 tests, all green).
- [x] T-06 — Updated `caja-page.tsx`: Tab union extended to `"historial"`, third tab button added, three-branch conditional render, "Liquidaciones realizadas" section and `hasSealed`/`sealedGroups` dead code fully removed from `SettlementsTab`.
- [x] T-07 — Updated `caja-page.test.tsx`: added `useSettledSettlements` mock, added "Historial tab button exists" test and "Liquidaciones tab has no realizadas section" test.

## Additional fix
- Updated `settlement-statement.test.tsx`: migrated the 4 `CajaPage — Comprobante actions` tests from the (now-removed) Liquidaciones "realizadas" section to navigate through the Historial tab and expand rows. R-C12 test updated to reflect the single-expanded accordion model.

## Files changed

| File | Action |
|------|--------|
| `src/features/caja/lib/caja-math.ts` | edited — added `SealedBreakdown` re-export, `SettlementForGrouping`, `SealedGroup`, `groupSealedBySettlementGroup` |
| `src/features/caja/__tests__/caja-math.test.ts` | edited — added `groupSealedBySettlementGroup` describe block (9 tests) |
| `src/features/caja/hooks/use-settled-settlements.ts` | new — bounded settled-only query hook |
| `src/features/caja/components/sealed-settlement-actions.tsx` | new — relocated from caja-page.tsx |
| `src/features/caja/components/historial-tab.tsx` | new — history table with expandable breakdown rows |
| `src/features/caja/components/__tests__/historial-tab.test.tsx` | new — 7 render tests |
| `src/features/caja/components/caja-page.tsx` | edited — 3-tab union, HistorialTab wired, "realizadas" section removed |
| `src/features/caja/__tests__/caja-page.test.tsx` | edited — 2 new tests + useSettledSettlements mock |
| `src/features/caja/__tests__/settlement-statement.test.tsx` | edited — migrated comprobante action tests to Historial tab |

## Final verification
- `npm test -- --run`: 36 test files, 248 tests, all green
- `npm run build`: TypeScript clean, Vite build succeeds (large chunk warning is pre-existing from `@react-pdf/renderer`)
