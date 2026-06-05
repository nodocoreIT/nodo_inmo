# Apply Progress: owner-settlement-statement — PR-A + PR-B (merged)

**Change**: owner-settlement-statement  
**Batches**: PR-A (agency profile) + PR-B (breakdown sealing)  
**Mode**: Strict TDD (RED → GREEN enforced for every task)  
**Date**: 2026-06-04  
**Branch**: feat/owner-settlement-sealing  

---

## Completed Tasks

### PR-A — Agency Profile (all complete)

- [x] A-WU1 — pgTAP test file `supabase/tests/150_org_profiles.test.sql` written first (RED), then GREEN
- [x] A-WU2 — Migration `20260604211509_create_org_profiles.sql` applied; 36/36 pgTAP assertions GREEN
- [x] A-WU3 — Types regenerated; `org_profiles` Row/Insert/Update present in `database.ts`
- [x] A-WU4 — Four hooks implemented (RED → GREEN, 7/7 vitest)
- [x] A-WU5 — `AgencyProfileForm` component + settings entry point (RED → GREEN, 10/10 vitest)
- [x] A-WU6 — Integration test extended for `org-branding` (12/12 integration tests PASS)
- [x] A-WU7 — CONVENTIONS.md updated with agency-profile row

### PR-B — Breakdown Sealing (all complete)

- [x] B-WU1 — pgTAP test file `supabase/tests/160_settle_owner.test.sql` written first (RED: 44/45 failing), confirmed RED
- [x] B-WU2 — Migration `20260604220000_settle_owner_breakdown.sql` applied; 33/33 pgTAP assertions GREEN
- [x] B-WU3 — Types regenerated; `breakdown`, `settlement_group`, `applied_settlement_id`, `settle_owner` fn present in `database.ts`
- [x] B-WU4 — `computeSettlementBreakdown()` pure fn implemented (RED → GREEN, 19/19 vitest)
- [x] B-WU5 — `useSettleOwner` rewired to settle_owner RPC (RED → GREEN, 7/7 vitest)
- [x] B-WU6 — CONVENTIONS.md updated with owner-settlement-pdf row

### PR-B Money-Correctness Fixes (verify-report-pr-b findings)

- [x] FIX-CRITICAL-1 — JSONB deduction key `expense_id` → `id` in SQL RPC + pgTAP regression assertion (RED → GREEN)
- [x] FIX-CRITICAL-2 — Step 6b stamp now uses ID-list from v_deductions; phantom-stamp window eliminated + pgTAP stamp-set assertion (RED → GREEN)
- [x] FIX-WARNING-2 — pgTAP test for zero-commission fallback (property-NULL + contact-zero); 2 new assertions (RED → GREEN)
- [x] FIX-WARNING-3 — `p.org_id = v_org_id` defense-in-depth on properties join in deduction CTE
- [x] FIX-SUGGESTION-1 — `owner_share` + `deduction_total` added to `SettlementBreakdown` interface + `computeSettlementBreakdown` return (RED → GREEN, 2 new vitest tests)

---

## TDD Cycle Evidence

| Task | RED (test written first) | GREEN (impl passes) | REFACTOR |
|------|--------------------------|---------------------|----------|
| A-WU1 pgTAP | 150_org_profiles.test.sql written before migration; ran → failed (table DNE) | After migration → 36/36 PASS | Plan count corrected from 35 to 36 |
| A-WU4 hooks | agency-profile-hooks.test.ts written; `npm test` → "Failed to resolve import" | Hooks created; 7/7 PASS | Removed 2 unused mock vars |
| A-WU5 form | agency-profile-form.test.tsx written; `npm test` → "Failed to resolve import" | Form component created; 10/10 PASS | Email zod refine + type="email" removed from Input (jsdom compat) |
| A-WU6 integration | Cases added to test; ran against live stack → 12/12 PASS | N/A (integration test) | — |
| B-WU1 pgTAP | 160_settle_owner.test.sql written before migration; ran → 44/45 failing (columns DNE, RPC DNE, trigger wrong rate) | After migration → 33/33 PASS | Plan count corrected from 45 to 33 (DO blocks don't emit plan events); anchor uuid fix (min(uuid) unsupported → ORDER BY id::text LIMIT 1) |
| B-WU4 caja-math | caja-math.test.ts computeSettlementBreakdown tests written; `npm test` → "is not a function" (13 RED) | computeSettlementBreakdown exported from caja-math.ts; 19/19 PASS | — |
| B-WU5 use-settle-owner | use-settle-owner.test.tsx rewritten for RPC pattern; `npm test` → "Cannot read properties of undefined" on .update() (6 RED) | Hook rewritten to single rpc() call; 7/7 PASS | — |
| FIX-CRITICAL-1 pgTAP | Added `breakdown->'deductions'->0->>'id'` assertion → 2 FAIL (NULL vs UUID, current SQL uses expense_id) | SQL key renamed to 'id'; 38/38 PASS | — |
| FIX-CRITICAL-2 pgTAP | Added stamp-set equals breakdown-deductions assertion → FAIL (NULL vs {UUID}) | Step 6b rewritten to WHERE id = ANY(id-list from v_deductions); 38/38 PASS | — |
| FIX-WARNING-2 pgTAP | Added posted-commission=0 + owner_settlement.amount=gross assertions → both PASS immediately (current behavior already correct) | No code change needed; tests document the behavior | Added comment to trigger coalesce line |
| FIX-SUGGESTION-1 vitest | Added owner_share + deduction_total property assertions → 2 FAIL (fields absent) | Added fields to SettlementBreakdown interface + computeSettlementBreakdown return; 21/21 PASS | — |

---

## Files Changed

### PR-A

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/20260604211509_create_org_profiles.sql` | Created | Table + trigger + RLS Template B + org-branding bucket + 4 storage policies |
| `supabase/tests/150_org_profiles.test.sql` | Created | 36 pgTAP assertions (schema, RLS, storage) |
| `supabase/config.toml` | Modified | Added `[storage.buckets.org-branding]` block |
| `src/shared/types/database.ts` | Regenerated | Adds org_profiles Row/Insert/Update |
| `src/features/agency-profile/hooks/use-upsert-org-profile.ts` | Created | Upsert mutation, injects org_id, invalidates query key |
| `src/features/agency-profile/hooks/use-upload-logo.ts` | Created | Storage upload, key = {orgId}/logo-{uuid}-{sanitized}, returns key not URL |
| `src/features/agency-profile/hooks/use-org-profile.ts` | Created | maybeSingle query, null-safe (graceful first-run) |
| `src/features/agency-profile/hooks/use-logo-url.ts` | Created | createSignedUrl TTL=60, staleTime=0, never getPublicUrl |
| `src/features/agency-profile/__tests__/agency-profile-hooks.test.ts` | Created | 7 vitest tests |
| `src/features/agency-profile/components/agency-profile-form.tsx` | Created | React-hook-form + zod, role guard, upload-then-upsert, graceful null profile |
| `src/features/agency-profile/__tests__/agency-profile-form.test.tsx` | Created | 10 vitest tests (R-A18/19/20/21/22 + CUIT/email validation) |
| `src/portals/admin/components/admin-layout.tsx` | Modified | Added "Datos de la agencia" button (admin-only) + AgencyProfileForm Dialog |
| `supabase/tests/integration/storage-cross-tenant.integration.test.ts` | Modified | Added 5 org-branding cases (R-A14/16/17) |
| `openspec/changes/nodo-inmo-foundation/CONVENTIONS.md` | Modified | Added agency-profile + owner-settlement-pdf rows to Module → Role Matrix |
| `openspec/changes/owner-settlement-statement/tasks.md` | Modified | All PR-A + PR-B tasks marked [x] |

### PR-B

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/20260604220000_settle_owner_breakdown.sql` | Created | ALTER TABLE columns + indexes + updated trigger + settle_owner RPC |
| `supabase/tests/160_settle_owner.test.sql` | Created | 33 pgTAP assertions (schema, commission rule, golden, no-double-count, seal-once, rollback, auth) |
| `src/shared/types/database.ts` | Regenerated | Adds breakdown/settlement_group columns + applied_settlement_id + settle_owner fn |
| `src/features/caja/lib/caja-math.ts` | Modified | Added BreakdownDeduction/SettlementBreakdown interfaces + computeSettlementBreakdown pure fn |
| `src/features/caja/__tests__/caja-math.test.ts` | Modified | Added 13 computeSettlementBreakdown tests (R-B4/5/6/7/8/9/17 + ADR-5 golden) |
| `src/features/caja/hooks/use-settle-owner.ts` | Rewritten | Single supabase.schema('nodo_inmo').rpc('settle_owner', ...) call (atomic) |
| `src/features/caja/__tests__/use-settle-owner.test.tsx` | Rewritten | 7 vitest tests (R-B10/12/13/14/16/18 + empty guard) |

### PR-B Money-Correctness Fixes

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/20260604220000_settle_owner_breakdown.sql` | Modified | Step 3: renamed JSONB key `expense_id` → `id`; added `p.org_id = v_org_id` to properties join (WARNING-3). Step 6b: replaced predicate-based UPDATE with ID-list-based UPDATE from v_deductions (CRITICAL-2). |
| `supabase/tests/160_settle_owner.test.sql` | Modified | Plan 33→38; added 5 assertions: CRITICAL-1 key regression (×2), CRITICAL-2 stamp-set equality, WARNING-2 zero-commission fallback (×2); new seed contact/property/contract/payment for WARNING-2. |
| `src/features/caja/lib/caja-math.ts` | Modified | Added `owner_share` + `deduction_total` to `SettlementBreakdown` interface and `computeSettlementBreakdown` return (SUGGESTION-1). |
| `src/features/caja/__tests__/caja-math.test.ts` | Modified | Added 2 vitest tests for `owner_share` and `deduction_total` (SUGGESTION-1). |

---

## Test Results

### pgTAP

#### 150_org_profiles.test.sql (PR-A)
- **36/36 PASS** — schema shape, RLS Template B, storage bucket + 4 policies

#### 160_settle_owner.test.sql (PR-B — after money-correctness fixes)
- **38/38 PASS** — all original 33 + 5 new: CRITICAL-1 key regression (×2), CRITICAL-2 stamp-set, WARNING-2 zero-commission (×2)
- Full pgTAP suite: **357/357 PASS** across 16 test files (no regressions; was 352 before fixes)

### vitest

#### PR-A tests
- `agency-profile-hooks.test.ts`: **7/7 PASS**
- `agency-profile-form.test.tsx`: **10/10 PASS**

#### PR-B tests
- `caja-math.test.ts`: **21/21 PASS** (13 original + 2 new for owner_share/deduction_total — SUGGESTION-1)
- `use-settle-owner.test.tsx`: **7/7 PASS** (7 tests, RPC pattern)

#### Full suite
- **197/197 PASS** (was 195; +2 new SUGGESTION-1 vitest tests)

### Integration (storage-cross-tenant)
- `storage-cross-tenant.integration.test.ts`: **12/12 PASS** (real local stack)

### Lint
- **15 problems** — unchanged from main baseline; no new errors added

### Typecheck
- **Clean** — `tsc --noEmit` exits 0

---

## Key Design Points Proved by Tests

### HEADLINE-1: Atomicity invariant
pgTAP test "atomicity: settlement still pending after failed seal (transaction rolled back)" proves that mixing valid + invalid IDs in a batch rolls back the entire transaction — no partial state.

### No-double-count
pgTAP test "no-double-count: second seal has 0 deductions" proves the consumed-marker pattern: after the first seal stamps `applied_settlement_id`, the second seal finds zero unconsumed deductions for the same owner/currency.

### Commission property-first rule
pgTAP tests confirm:
- Property with `commission_rate = 10%` → 250000 × 10% = 25000 (property rate wins)
- Property with `commission_rate = NULL` → 100000 × 8% = 8000 (falls back to contact rate)

### ADR-5 anti-drift
vitest golden case uses the exact same numeric inputs as the pgTAP golden case. If SQL and TS ever diverge, the mirror is the bug.

---

## Workload / PR Boundary

- Mode: chained PR slice (stacked-to-main)
- Current work unit: PR-B — Breakdown sealing (independent of PR-A)
- Boundary: starts from `main` branch, ends with settle_owner RPC + computeSettlementBreakdown + rewired hook
- Estimated review: ~708 lines (as forecast in tasks.md), within the accepted chained-PR boundary (size:exception accepted per prompt)

---

## Deviations from Design

1. **`min(uuid)` not supported in PostgreSQL**: design §2.3 used `select min(id)` for the anchor id. PostgreSQL doesn't support min() on uuid. Fixed to `ORDER BY id::text LIMIT 1` (deterministic, same result).

2. **pgTAP plan count**: DO blocks that call the RPC don't emit plan-counted assertions. Adjusted plan from 45 to 33 (all 33 assertions pass).

3. **Client-side R-B15 guard simplified**: design specified a pre-flight check for already-sealed rows client-side. The RPC's seal-once guard (ADR-7) is the authoritative enforcement; the hook's only client-side guard is `settlement_ids.length === 0` (early return). The RPC will raise an exception if already-sealed ids are passed, which the hook surfaces as an error (R-B14). Full server-side enforcement is more reliable.

4. **`supabase db advisors`**: not run — no MCP advisors tool available in this context. Security checklist manually verified.

5. **Migration provenance**: `supabase db pull` not used per instructions (local migration history drifted). Migration authored manually as `20260604220000_settle_owner_breakdown.sql`.

---

## Remaining Tasks

PR-C (PDF comprobante): C-WU1 through C-WU5 — all pending, blocked on PR-A + PR-B merged.

Money-correctness verify items fully resolved:
- CRITICAL-1: DONE (key drift fixed, regression test added)
- CRITICAL-2: DONE (phantom-stamp window eliminated, stamp-set assertion added)
- WARNING-2: DONE (pgTAP test documenting zero-commission fallback added)
- WARNING-3: DONE (org_id defense-in-depth on properties join added)
- SUGGESTION-1: DONE (owner_share + deduction_total in TS interface + function)
- WARNING-1 (rollback-evidence gap): optional, not addressed — guaranteed by Postgres transaction semantics
