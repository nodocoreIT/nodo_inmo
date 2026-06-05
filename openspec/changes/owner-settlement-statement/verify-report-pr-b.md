# Verify Report: PR-B — Breakdown Sealing (Real Money)

**Change**: owner-settlement-statement  
**Scope**: PR-B only — `settle_owner` RPC, `breakdown`/`applied_settlement_id` columns, trigger update, `computeSettlementBreakdown()`, `useSettleOwner` rewire  
**Branch**: `feat/owner-settlement-sealing`  
**Date**: 2026-06-04  
**Verdict**: PASS WITH WARNINGS

---

## Summary

2 CRITICALs, 3 WARNINGs, 2 SUGGESTIONs.

The atomicity invariant is sound; the RPC is one transaction with `FOR UPDATE` locks that prevent the main concurrent double-count race. The commission property-first rule is correctly implemented and tested. The seal-once guard works. The rollback test is real, not vacuous.

The two CRITICALs are: (1) a JSONB key name divergence between the SQL canonical output (`expense_id`) and the TS `BreakdownDeduction` interface (`id`) that will cause `undefined` reads in the PR-C PDF and is not caught by any current test; and (2) a phantom-stamp window where expenses inserted AFTER the deduction CTE lock but BEFORE step 6b stamp would get consumed silently, causing a breakdown/stamp mismatch.

---

## Spec Compliance Matrix (R-B requirements)

| Req | Description | Status | Evidence |
|-----|-------------|--------|---------|
| R-B1 | `owner_settlements.breakdown` jsonb nullable | PASS | migration line 15-16; pgTAP test 3 (col_is_null) |
| R-B2 | `property_expenses.applied_settlement_id` uuid FK | PASS | migration line 22-25; pgTAP tests 6-9 |
| R-B3 | Index on `applied_settlement_id` | PASS | `property_expenses_unapplied_idx` partial index; pgTAP test 10 |
| R-B4 | `computeSettlementBreakdown` signature exported | PASS | caja-math.ts:114; caja-math.test.ts line 69 |
| R-B5 | `gross` = sum of payment amounts | PASS | caja-math.test.ts line 74 |
| R-B6 | `commission` from cash_movements (not rate×gross) | PASS | caja-math.test.ts lines 86-107; pgTAP golden |
| R-B7 | `deductions` currency-isolated | PASS | caja-math.test.ts line 110; pgTAP currency boundary |
| R-B8 | `net = gross − commission − sum(deductions)` | PASS | caja-math.test.ts line 126; pgTAP net identity assertion |
| R-B9 | Function pure (same inputs → same output) | PASS | caja-math.test.ts line 166 |
| R-B10 | Hook queries unconsumed chargeable expenses | PASS (delegated to RPC) | Hook is now a single RPC call; RPC enforces this server-side |
| R-B11 | Already-consumed expenses never included | PASS | pgTAP no-double-count; `applied_settlement_id is null` predicate |
| R-B12 | Breakdown written to `owner_settlements.breakdown` | PASS | pgTAP golden: breakdown non-null after seal |
| R-B13 | Consumed expenses stamped with `applied_settlement_id` | PASS | pgTAP golden: ARS expense stamped; step 6b in RPC |
| R-B14 | Atomic seal | PASS* | pgTAP rollback test; single function body = one transaction (*see WARNING-1) |
| R-B15 | Seal-once guard — re-sealing refuses | PASS | pgTAP seal-once `throws_ok` test |
| R-B16 | Second settlement sees zero already-consumed expenses | PASS | pgTAP no-double-count test (deduction_total = 0 on second seal) |
| R-B17 | Breakdown shape: `gross`, `commission_rate`, `commission`, `deductions`, `net` | CRITICAL (deduction key drift) | TS interface `id` vs SQL `expense_id` — see CRITICAL-1 |
| R-B18 | Breakdown immutable (no update-after-seal path) | PASS | Single RPC call in hook; use-settle-owner.test.tsx one-rpc assertion |

---

## Issues

### CRITICAL-1 — JSONB deduction key `expense_id` vs TS interface `id`

**Location**: `supabase/migrations/20260604220000_settle_owner_breakdown.sql` line 224 vs `src/features/caja/lib/caja-math.ts` lines 89, 139.

**What the SQL produces** (the canonical frozen snapshot):
```jsonc
{ "deductions": [{ "expense_id": "uuid", "amount": 12000, ... }] }
```

**What the TS `BreakdownDeduction` interface expects**:
```ts
interface BreakdownDeduction {
  id: string;        // ← "id", not "expense_id"
  ...
}
```

**Impact**: When PR-C reads the sealed `breakdown` JSONB from `owner_settlements` and casts it to `SettlementBreakdown`, every deduction's `id` field will be `undefined`. The deduction table in the PDF will have no expense IDs. Any code path that uses `d.id` to look up or display expense details will silently get `undefined`. Spec R-B17 requires the key `id`; the SQL writes `expense_id`.

**Not caught by any test**: pgTAP only asserts `jsonb_array_length` (not individual keys); the `use-settle-owner.test.tsx` fixture uses `expense_id` (consistent with the SQL output) but `BreakdownDeduction` is typed `id`. The caja-math tests use `id` in their expense inputs but this only tests the TS mirror, not the sealed JSONB.

**Fix**: Either rename the SQL JSONB key from `expense_id` to `id` (change `'expense_id', id` to `'id', id` in the `jsonb_build_object` call), or rename the TS interface field to `expense_id`. Given that the spec requires `id` and the design doc's JSONB schema also shows `expense_id`, I recommend renaming the SQL key to `id` to match the spec — and adding a pgTAP assertion that checks the actual key name, not just the array length.

---

### CRITICAL-2 — Phantom-stamp window in step 6b (breakdown/stamp mismatch)

**Location**: `supabase/migrations/20260604220000_settle_owner_breakdown.sql` lines 207-232 (step 3 CTE) vs lines 263-273 (step 6b stamp).

**The gap**: Step 3 uses `FOR UPDATE OF e` inside a CTE to lock unconsumed expenses and compute `v_deductions`. Step 6b then stamps expenses using an independent `UPDATE` with the same predicate (`applied_settlement_id is null`). At READ COMMITTED isolation (PostgreSQL default for RPC calls), each SQL statement sees a fresh snapshot. An expense row inserted by a concurrent transaction AFTER step 3 completes (and thus not locked and not included in `v_deductions`) but BEFORE step 6b executes WOULD be stamped by step 6b — consuming an expense that does not appear in the frozen breakdown JSONB.

**Concrete scenario**: 
1. Admin triggers Liquidar for owner O. Function starts, step 3 locks E1 (12000 ARS).
2. Concurrent session (another admin or a background import) inserts expense E4 (5000 ARS, charged_to_owner=true) for the same owner, committed before step 6b runs.
3. Step 6b stamps BOTH E1 AND E4 with `applied_settlement_id`.
4. Result: breakdown JSONB shows `deduction_total = 12000`, `net = 438000` — but E4 is now consumed and unavailable for future settlements. The owner was not deducted E4 in this settlement, but E4 can never appear in a future settlement either. **Silent money loss.**

**Likelihood**: Low in normal single-admin usage. High risk in bulk import flows or concurrently active admin sessions.

**Fix**: Step 6b must stamp ONLY the expenses that were selected in step 3 — identified by their IDs captured in `v_deductions`. Change step 6b from a predicate-based `UPDATE` to an `UPDATE ... WHERE id = ANY(array_of_ids_from_step3)`:

```sql
-- 6b. Stamp ONLY the expenses that were in the deductions CTE (not a blind predicate re-run).
update nodo_inmo.property_expenses
   set applied_settlement_id = v_anchor_id
 where id = any(
   select (elem->>'expense_id')::uuid
   from jsonb_array_elements(v_deductions) elem
 );
```

This makes step 6b's stamp set exactly equal to step 3's deduction set, eliminating the phantom window. After fixing CRITICAL-1, the key would be `'id'` instead of `'expense_id'`.

---

### WARNING-1 — Atomicity proof test is real but incomplete (rollback proven for lock-count failure, not for mid-write failure)

**Location**: `supabase/tests/160_settle_owner.test.sql` section F, lines 336-375.

**What the test does**: Passes valid + nonexistent IDs → the count-check guard in step 1 fires before any write → `throws_ok`. Then asserts `status = 'pending'` and `breakdown is null`.

**What it does NOT test**: A failure that occurs AFTER step 6a (the `UPDATE owner_settlements`) but before step 6b completes. In the current RPC design, both writes are in the same function body (one transaction), so any unhandled exception after 6a would roll 6a back automatically. However, there is no test that explicitly proves "6a wrote but 6b failed → both rolled back". The test only proves the guard-failure path (nothing was written). A genuine mid-write failure test would need a different mechanism (e.g., a check constraint on `property_expenses` triggered conditionally, or a `RAISE` injected after step 6a).

**Severity**: WARNING rather than CRITICAL because PostgreSQL transaction semantics guarantee automatic rollback on any unhandled exception — the rollback IS real. The test gap is an evidence gap, not a behaviour gap. But the design doc lists this as the "atomicity proof" and it's not fully testing what it claims.

---

### WARNING-2 — Trigger NULL-NULL commission rate is zero, not an error — undocumented and untested

**Location**: `supabase/migrations/20260604220000_settle_owner_breakdown.sql` lines 64-66 (trigger).

The trigger computes: `coalesce(p.commission_rate, coalesce(ct.commission_rate, 0))`. If BOTH the property and the contact have `commission_rate = NULL`, the result is `0`. This means a cobro for such a contract posts commission = 0 and owner_share = full amount. This is probably correct business logic, but:

1. It is not documented in the design (the design only describes "property-first, contact fallback").
2. There is no pgTAP test for the both-NULL case.
3. It silently produces a zero-commission cobro, which could indicate a misconfigured contract. A future debugging session would find a cobro with 0% commission and no obvious reason.

**Fix**: Add a pgTAP test for the both-NULL case asserting the expected 0-commission behavior, and add an inline comment to the trigger at the coalesce line.

---

### WARNING-3 — Deduction CTE does NOT cross-check `p.org_id = v_org_id` on the properties join

**Location**: `supabase/migrations/20260604220000_settle_owner_breakdown.sql` lines 210-218 (step 3 CTE).

The deduction query is:
```sql
from nodo_inmo.property_expenses e
join nodo_inmo.properties p on p.id = e.property_id
where p.owner_id = p_owner_id
  and e.org_id = v_org_id
  ...
```

This filters on `e.org_id = v_org_id` but NOT on `p.org_id = v_org_id`. In the `SECURITY INVOKER` context, RLS on `properties` gates rows to `p.org_id = caller's org_id`, so in practice a cross-org property read is blocked by RLS. However, `SECURITY INVOKER` means RLS on `properties` will apply only if the table has RLS enabled (it should). If RLS on `properties` were ever disabled for debugging, the missing `p.org_id` filter would allow cross-org deduction queries.

This is a defense-in-depth gap. The explicit `e.org_id = v_org_id` check is present; the join just lacks the symmetric `p.org_id = v_org_id` constraint.

**Likewise in step 6b**: the stamp UPDATE uses `EXISTS (SELECT 1 FROM properties p WHERE p.id = e.property_id AND p.owner_id = p_owner_id)` without `p.org_id = v_org_id`.

**Fix**: Add `and p.org_id = v_org_id` to both the step 3 CTE join condition and the step 6b EXISTS subquery.

---

### SUGGESTION-1 — ADR-5 anti-drift golden test does not verify `owner_share` or `deduction_total` fields

**Location**: `src/features/caja/__tests__/caja-math.test.ts` lines 199-226.

The TS `SettlementBreakdown` interface does NOT include `owner_share` or `deduction_total` (only `gross`, `commission_rate`, `commission`, `deductions`, `net`). The SQL JSONB includes both. The ADR-5 golden test in caja-math.test.ts correctly tests the TS interface fields. However, the design explicitly intends the TS mirror to document the same arithmetic as SQL. The TS mirror cannot detect a drift in `owner_share` because it doesn't compute or expose it.

This is acceptable by design (the TS mirror is display-only, not a full replica). The suggestion is to add `owner_share` and `deduction_total` to `SettlementBreakdown` as optional fields so PR-C can read them from the frozen snapshot without a cast.

---

### SUGGESTION-2 — pgTAP does not assert the internal structure of deduction elements

**Location**: `supabase/tests/160_settle_owner.test.sql` lines 240-245.

The golden test only checks `jsonb_array_length(breakdown->'deductions') = 1`. It does not assert the key names or values inside the deduction element. A more complete assertion would be:

```sql
select is(
  (breakdown->'deductions'->0->>'expense_id'),  -- or 'id' after CRITICAL-1 fix
  'b0000000-0000-0000-0000-0000000000e1'::text,
  'golden: deduction element has correct expense_id');
select is(
  (breakdown->'deductions'->0->>'amount')::numeric,
  12000.00,
  'golden: deduction element has correct amount');
```

This would have caught CRITICAL-1 before merge.

---

## Atomicity Audit (detailed)

### Is the seal one transaction? YES.

The `settle_owner` function is `LANGUAGE plpgsql`. Every plpgsql function invoked via `supabase.rpc()` executes inside a single transaction unless it contains explicit `COMMIT`/`ROLLBACK` (which this function does not). Steps 1 through 6b are all within the single function body. A failure at any point (lock check, count mismatch, any of the two UPDATEs) raises an exception that rolls back the entire transaction. PostgreSQL autocommit does not split function bodies.

### Are there `FOR UPDATE` locks? YES.

Step 1: `SELECT ... FOR UPDATE` on `owner_settlements` — prevents concurrent double-seal of the same rows.  
Step 3: `FOR UPDATE OF e` inside the deductions CTE — prevents a concurrent settle from picking the same expenses. See CRITICAL-2 for the phantom-insert gap.

### Can partial state occur? Only via CRITICAL-2 (phantom stamp).

Partial state in the sense of "settlement updated but expenses not stamped" cannot occur within the function body (same transaction). CRITICAL-2 is a different kind of partial state: the stamp SET is larger than the breakdown SET.

---

## No-Double-Count Audit

### Is the test real? YES.

Section D of the pgTAP test (lines 273-309) seeds a new payment (`d4`), marks it paid (trigger fires, new `owner_settlements` row created), calls `settle_owner` again, and asserts:
- `jsonb_array_length(breakdown->'deductions') = 0`
- `deduction_total = 0`

This is a genuine behavioral assertion, not vacuous. The ARS expense E1 was stamped with `applied_settlement_id` by the first seal, so the second seal's CTE finds zero unconsumed ARS expenses. This directly proves the no-double-count invariant.

### Can a concurrent second call race in before the stamp commits?

The `FOR UPDATE OF e` lock in step 3 prevents a concurrent `settle_owner` call (same owner, same currency) from selecting the same expenses until the first call commits. When the first call commits, the expenses have non-null `applied_settlement_id`, so the second call's CTE filter (`applied_settlement_id is null`) correctly excludes them. The concurrency protection is sound.

---

## Commission Property-First Rule Audit

The trigger update correctly implements `coalesce(p.commission_rate, coalesce(ct.commission_rate, 0))`. The inner `coalesce(ct.commission_rate, 0)` ensures a NULL contact rate also defaults to zero. The pgTAP tests cover:
- Property with own rate (10%) → uses property rate ✓
- Property with NULL rate → falls back to contact rate (8%) ✓
- Both NULL case → not tested (see WARNING-2)

---

## Security / INVOKER Audit

- `SECURITY INVOKER`: confirmed (migration line 124). The function runs under the caller's RLS.
- `set search_path = ''`: confirmed (migration line 125). Fully-qualified names throughout.
- Explicit `role = 'admin'` check: confirmed (lines 143-145). Fails fast before any lock or write.
- `org_id` extracted from JWT, used in all predicates: confirmed.
- Cross-org RLS: the existing Template B policies on `owner_settlements` and `property_expenses` remain in force (no new policies added in PR-B). INVOKER means those policies gate every row the function touches.
- Authorization pgTAP tests: agent blocked (`throws_ok`); wrong-org admin blocked (`throws_ok`). Both are real behavioral assertions.
- Missing `p.org_id = v_org_id` on properties join: see WARNING-3.

---

## TS/SQL Drift Audit

The ADR-5 golden test (`caja-math.test.ts` lines 199-226) uses the EXACT same numeric inputs as the pgTAP golden case:
- 2 × 250000 ARS payments → gross = 500000
- 2 × 25000 commission movements → commission = 50000
- 1 × 12000 ARS expense → deduction_total = 12000
- Expected: net = 438000

The TS function produces the same net as the SQL RPC on this fixture. The arithmetic is consistent.

The ONLY drift is the field name `id` vs `expense_id` (CRITICAL-1). The arithmetic is not drifted.

---

## Task Completeness

All B-WU* tasks marked `[x]` in apply-progress. Tasks B-WU1 through B-WU6 match the actual files in the repository. No incomplete tasks.

---

## Test Evidence

| Suite | Count | Result |
|-------|-------|--------|
| pgTAP 160_settle_owner | 33/33 | PASS |
| pgTAP full suite | 352/352 | PASS (no regressions) |
| vitest caja-math | 19/19 | PASS |
| vitest use-settle-owner | 7/7 | PASS |
| vitest full suite | 195/195 | PASS (per orchestrator pre-confirmation) |
| TypeScript (tsc --noEmit) | — | CLEAN |
| ESLint | 15 problems | No new errors vs main baseline |

---

## Final Verdict

**PASS WITH WARNINGS**

The money invariants are substantially sound. The primary architectural decision (single-RPC atomicity) is correctly implemented. However, CRITICAL-1 (key name drift) will cause silent `undefined` reads in PR-C unless fixed before that PR ships, and CRITICAL-2 (phantom-stamp window) is a latent correctness defect that could silently consume expenses not shown in the breakdown under concurrent inserts.

**Recommended path**: Fix CRITICAL-1 and CRITICAL-2 in the current PR before merging, then proceed to `sdd-archive` after re-running the pgTAP suite. WARNING-1/2/3 can be addressed in follow-up tasks or PR-C scope if desired.
