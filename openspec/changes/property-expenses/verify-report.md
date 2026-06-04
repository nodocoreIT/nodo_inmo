# Verify Report: property-expenses — PR 1 (DB + types)

**Branch:** `feat/property-expenses-db`
**Date:** 2026-06-04
**Scope:** PR 1 only (DB + types). Frontend (PR 2) is out of scope.
**Test run:** pgTAP suite executed locally — `140_property_expenses.test.sql` 36/36 GREEN.
**Pre-existing failures:** `130_caja_posting.test.sql` tests 1-2 (isolation issue predating this change, documented in apply-progress).

---

## Verdict: PASS WITH WARNINGS

0 CRITICAL · 3 WARNING · 3 SUGGESTION

---

## Test Suite Results

```
supabase/tests/140_property_expenses.test.sql ... ok   (36/36)
```

All 36 assertions confirmed GREEN on the local Supabase stack.
`plan(36)` matches the actual assertion count exactly.

---

## Security Audit

### Receipt photo access control (HEADLINE RISK)

**Bucket privacy — PASS**
- Migration: `public = false` in `INSERT INTO storage.buckets` (line 116).
- `config.toml`: `[storage.buckets.property-expense-receipts]` with `public = false` (line 121-124).
- pgTAP R15 assertion confirms `(select public from storage.buckets where id = 'property-expense-receipts') = false`.
- Bucket name is `property-expense-receipts` everywhere — the design §4.1 discrepancy (`property-receipts`) was correctly resolved in favor of the spec (normative).

**Storage policies — PASS with WARNING (see W1)**
- Four `storage.objects` policies present: `receipts_admin_{select,insert,update,delete}`.
- Each policy gates on: `bucket_id = 'property-expense-receipts'` AND `(storage.foldername(name))[1] = JWT org_id` AND `JWT role = 'admin'`.
- Upsert requires INSERT + SELECT + UPDATE — all three present.
- UPDATE policy has both `USING` and `WITH CHECK`.
- Text comparison (no `::uuid` cast on the path segment) is correct — avoids cast errors on malformed paths and denies access.
- Uses `app_metadata` throughout — never `user_metadata`.

**Cross-tenant signed-URL denial — NOT assertable via pgTAP**
Manual check required (WU7 in tasks):
```bash
# As admin of org A: upload a receipt
# As admin of org B: attempt createSignedUrl on org A's key → must be denied
# Exact path to test: {orgA_id}/{propertyId}/{uuid}-{filename}
# Expected: Supabase returns 400 / "Unauthorized"

# Public URL check:
curl -I http://localhost:54321/storage/v1/object/public/property-expense-receipts/{any-key}
# Expected: 400 (bucket is private)
```
This manual check (WU7) is marked incomplete in the tasks — it must be completed before archive.

### RLS Template B

**PASS — identical to reference pattern**
Compared against `20260603203229_create_caja.sql` line by line:
- InitPlan-friendly form: `(select auth.jwt())` sub-select used in both `USING` and `WITH CHECK` — prevents per-row JWT parsing.
- `TO authenticated` on all four policies.
- Four policies: `admin_select`, `admin_insert`, `admin_update`, `admin_delete`.
- UPDATE has both `USING` and `WITH CHECK` — `org_id` reassignment blocked.
- No `user_metadata` references anywhere.
- Anon role has no USAGE on `nodo_inmo` schema — `throws_ok` on anon SELECT is the correct (stricter) behavior, not just 0 rows.

### `owner_chargeable_expenses` view

**PASS**
- `WITH (security_invoker = true)` present — view runs with caller's privileges, so Template B RLS on `property_expenses` is preserved.
- Filters `WHERE e.charged_to_owner = true` — only deduction-eligible rows exposed.
- `JOIN nodo_inmo.properties p ON p.id = e.property_id` — owner derivation is live, not denormalized.
- Exposes `p.owner_id` (actual column name in `properties`; the FK is named `properties_owner_contact_id_fkey` but the column is `owner_id` — correct).
- pgTAP R27/R28: admin sees the `true` row with correct `owner_id`; `false` row absent; agent sees 0 rows.

---

## Requirement-by-Requirement

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| R1 | Table exists in `nodo_inmo` | PASS | `has_table` asserts |
| R2 | Required columns, types, nullability | PARTIAL-PASS | NOT NULL + PK + FK asserted; `col_type_is` not used (see W2) |
| R3 | `charged_to_owner` NOT NULL, no default | PARTIAL-PASS | `col_not_null` + `col_hasnt_default` asserted; INSERT-without-it scenario not tested (see W3) |
| R4 | `amount > 0` | PASS | `throws_ok` on 0 and -1 |
| R5 | `type` in ('arreglo','compra_accesorio') | PASS | `throws_ok` on 'otro' |
| R6 | `currency` in ('ARS','USD') | PASS | `throws_ok` on 'EUR' |
| R7 | `updated_at` auto-maintained via trigger | PASS | DO block + `ok(true,...)` — `pg_sleep(0.02)` ensures timestamp advance |
| R8 | RLS enabled | PASS | `is(relrowsecurity, true)` |
| R9 | Admin reads own-org expenses | PASS | `cmp_ok(count, '>', 0)` |
| R10 | Admin can insert | PASS | `lives_ok` |
| R11 | Agent blocked (SELECT + INSERT) | PASS | `is(count, 0)` + `throws_ok` |
| R12 | Cross-org SELECT blocked | PASS | `is(count_of_orgF, 0)` under org E JWT |
| R13 | org_id cannot be reassigned | PASS-AMBIGUOUS | `throws_ok` fires but uses nonexistent org_id `000099` — FK violation fires before WITH CHECK (see W1) |
| R14 | Anon blocked | PASS | `throws_ok` (permission denied — stricter than 0 rows) |
| R15 | Bucket private | PASS | `is(public, false)` |
| R16 | Admin can upload (INSERT+SELECT+UPDATE) | PARTIALLY TESTED | Policy existence asserted; actual upload functionality requires manual/HTTP check (WU7) |
| R17 | Non-admin cannot read/write receipts | PARTIALLY TESTED | Policy structure verified; HTTP-level test is WU7 |
| R18 | Cross-org receipt access blocked | NOT TESTED in pgTAP | Manual check required (WU7) |
| R19 | Receipts never via public URL | PARTIALLY TESTED | `public=false` confirmed; HTTP check is WU7 |
| R20 | `receipt_path` stores key, not URL | NOT TESTED in pgTAP | Application-layer convention; will be covered in PR 2 vitest |
| R26 | No `cash_movements` touched on insert | PASS | DO block count before/after |
| R27 | View returns chargeable expenses | PASS | `is(owner_id, ...)` + `is(count_false, 0)` |
| R28 | Owner via `property_id → properties.owner_id` | PASS | Join verified by owner_id assertion |
| R29 | Advisors clean | PASS | Reported clean in apply-progress (cannot re-run in verify without stack mutation) |
| Locked: bucket name | `property-expense-receipts` | PASS | Correct everywhere |
| Locked: `amount > 0` | strictly positive | PASS | `check (amount > 0)` not `>= 0` |
| Locked: `receipt_path` nullable | optional photo | PASS | `col_is_null` asserts |

---

## Findings

### WARNING 1 — R13 test does not isolate the RLS WITH CHECK clause

**File:** `supabase/tests/140_property_expenses.test.sql`, line 171–176

The R13 `throws_ok` attempts to set `org_id = 'f0000000-0000-0000-0000-000000000099'` — a UUID that does not exist in `shared.organizations`. The FK constraint (`ON DELETE CASCADE` references `shared.organizations`) fires with a foreign key violation **before** the RLS engine evaluates the `WITH CHECK` predicate. The test passes and the update IS blocked, but it's blocked by the wrong mechanism.

To correctly isolate RLS WITH CHECK, the target `org_id` must be a valid, existing organization that the JWT owner does not belong to. The seeded Org F (`f0000000-0000-0000-0000-000000000002`) is perfect for this.

**Fix:**
```sql
-- R13: UPDATE cannot reassign org_id (WITH CHECK) — use existing Org F to isolate RLS
select throws_ok(
  $q$ update nodo_inmo.property_expenses
        set org_id = 'f0000000-0000-0000-0000-000000000002'  -- Org F (exists, but not in JWT)
      where id = 'e0000000-0000-0000-0000-0000000000c1' $q$,
  null, null, 'RLS: UPDATE cannot reassign org_id to valid other org (WITH CHECK)');
```

**Severity:** WARNING — the security guarantee is real (multiple layers block the operation), but the test does not prove which layer is doing the work.

---

### WARNING 2 — `col_type_is` assertions absent (spec R2)

**File:** `supabase/tests/140_property_expenses.test.sql`

Spec R2 requires verifying each column's **data type** via `information_schema.columns`. The test asserts NOT NULL, PK, and FK, but does not call `col_type_is` for any column. As a result, a column type regression (e.g., `amount` becoming `float8` instead of `numeric`) would not be caught.

Key columns to add (at minimum): `amount` (`numeric`), `charged_to_owner` (`boolean`), `expense_date` (`date`), `org_id`/`property_id`/`id` (`uuid`), `created_at`/`updated_at` (`timestamptz`).

**Severity:** WARNING — test gap, not a runtime security issue. Low regression risk for a new table, but per spec R2 these assertions are normative.

---

### WARNING 3 — `policies_are` on `storage.objects` will break when a second bucket's policies are added

**File:** `supabase/tests/140_property_expenses.test.sql`, lines 199–204

`policies_are('storage', 'objects', array[...4 policies...], ...)` asserts that EXACTLY those four policies exist on `storage.objects` — no more, no less. This will fail the moment PR 2 or any future PR adds another bucket with its own `storage.objects` policies (e.g., for contract documents or avatar uploads).

The correct approach is `has_policy` (one assertion per policy name) — but apply-progress notes `has_policy` is not available in the installed pgTAP version. A safe workaround is to query `pg_policies` directly:

```sql
-- Assert each policy exists individually:
select ok(
  exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='receipts_admin_select'),
  'storage policy receipts_admin_select exists');
-- (repeat for other 3 policies)
```

This assertion survives additional policies being added, unlike `policies_are`.

**Severity:** WARNING — this test will produce a false failure in a future PR and must be fixed before adding another storage bucket.

---

### SUGGESTION 1 — R3 INSERT scenario not tested

Spec R3 includes the scenario "insert without `charged_to_owner` is rejected (NOT NULL violation)". The test covers the structural property (`col_hasnt_default`) but not the runtime enforcement. A `throws_ok` with an INSERT that omits `charged_to_owner` would complete the spec coverage.

---

### SUGGESTION 2 — `030_rls_enabled.test.sql` not updated for `property_expenses`

The global RLS-enabled audit in `030_rls_enabled.test.sql` tests `shared.*` tables only. `nodo_inmo.property_expenses` is not in its scope (R8 is covered in `140_` instead). This is consistent with the existing per-module test pattern (caja, payments, etc. are also not listed there), but worth noting as a convention drift risk if someone edits that file expecting it to be exhaustive.

---

### SUGGESTION 3 — WU7 (manual storage cross-tenant check) must be completed before archive

The tasks mark WU7 as incomplete. It cannot be automated via pgTAP. Before the PR is archived:

1. Upload a receipt as admin of org A.
2. As admin of org B, attempt `createSignedUrl` on org A's object key → must return an error.
3. Hit the public URL pattern unauthenticated → must return 400/404.

Document the outcome in the PR description. Only then should `sdd-archive` be run.

---

## PR 1 Completion Checklist

| Item | Status |
|------|--------|
| Migration file committed | DONE |
| 36/36 pgTAP assertions GREEN | DONE |
| Types regenerated | DONE |
| Bucket `property-expense-receipts` private everywhere | DONE |
| Template B RLS matches reference pattern | DONE |
| View `security_invoker = true` | DONE |
| `advisors` clean | DONE (reported) |
| `130_caja_posting` failures pre-exist | CONFIRMED |
| WU7 manual storage check | INCOMPLETE |
| CONVENTIONS.md update | DEFERRED to PR 2 (WU6) |

---

## Files Audited

- `supabase/migrations/20260604110925_create_property_expenses.sql`
- `supabase/tests/140_property_expenses.test.sql`
- `supabase/config.toml`
- `src/shared/types/database.ts`
- `supabase/migrations/20260603203229_create_caja.sql` (reference for Template B pattern)
