# Apply Progress: property-expenses — PR 1 (DB + types)

**Branch:** `feat/property-expenses-db`
**Status:** DONE (PR 1 scope)
**Date:** 2026-06-04

---

## Work units completed

### WU1 — pgTAP test file (RED phase)
- [x] File: `supabase/tests/140_property_expenses.test.sql` (36 assertions)
- [x] All assertions confirmed RED before migration
- [x] R1–R7: table shape, constraints, trigger
- [x] R8–R14: RLS Template B (admin-only)
- [x] R15: bucket is private
- [x] Storage policies assertion (`policies_are` — `has_policy` not available in this pgTAP version)
- [x] R26: ledger isolation
- [x] R27/R28: deduction view + security_invoker

### WU2 — Migration (GREEN phase)
- [x] 2a: `nodo_inmo.property_expenses` table with all columns, constraints, indexes, trigger
  - `amount > 0` (strictly positive — spec normative, design `>=0` overridden)
  - `charged_to_owner boolean NOT NULL` — no default (ADR-4)
  - `receipt_path` nullable (optional photo)
  - `on delete restrict` on `property_id`, `on delete cascade` on `org_id`
  - Three indexes: `org_id_idx`, `property_id_idx`, `chargeable_idx` (partial)
  - `set_updated_at` trigger
- [x] 2b: RLS Template B — four policies (admin_select, admin_insert, admin_update, admin_delete)
  - All use `app_metadata` (never `user_metadata`)
  - UPDATE has both USING + WITH CHECK
- [x] 2c: Storage bucket `property-expense-receipts` (`public = false`, 10MiB, JPEG/PNG/WebP/PDF)
  - `config.toml` bucket declaration added
  - Four `storage.objects` policies (receipts_admin_{select,insert,update,delete})
- [x] 2d: View `nodo_inmo.owner_chargeable_expenses WITH (security_invoker = true)`
- [x] 2e: `supabase db advisors` — no issues found
- [x] Migration file: `supabase/migrations/20260604110925_create_property_expenses.sql`
- [x] All 36 pgTAP assertions GREEN

### WU3 — Types regeneration
- [x] `src/shared/types/database.ts` regenerated
  - `Database["nodo_inmo"]["Tables"]["property_expenses"]` present (Row/Insert/Update)
  - `Database["nodo_inmo"]["Views"]["owner_chargeable_expenses"]` present
- [x] Command: `/opt/homebrew/bin/supabase gen types typescript --local > src/shared/types/database.ts`

---

## Commits

1. `06ef80d` — `feat(db): property_expenses table + RLS + storage bucket + deduction view`
2. `dc6e174` — `chore(types): regen database.ts — add property_expenses + deduction view`

---

## Deviations from design

| Item | Design | Applied | Reason |
|------|--------|---------|--------|
| Amount constraint | `amount >= 0` | `amount > 0` | spec R4 is normative (tie-breaker per task instruction) |
| Bucket name | design §4.1 uses `property-receipts` | `property-expense-receipts` | spec R15 is normative (locked decision) |
| pgTAP `has_policy` | tasks used `has_policy(...)` per test | replaced with `policies_are(...)` | `has_policy` not available in installed pgTAP; `policies_are` confirms all four policies exist |
| anon test | tasks spec: `is(..., 0, ...)` count | replaced with `throws_ok` | `anon` has no USAGE on `nodo_inmo` schema; gets permission denied (stricter than 0 rows, correct security behavior) |

---

### Test-hardening pass (2026-06-04)

All five fixes from the verify-report applied and confirmed GREEN.

**FIX 1 — WARNING 1: R13 RLS WITH CHECK test now proves the guard**
- `140_property_expenses.test.sql` line ~171: changed target org_id from nonexistent
  `f0000000-0000-0000-0000-000000000099` to valid seeded Org F
  `f0000000-0000-0000-0000-000000000002`. FK is now satisfied; only the RLS WITH CHECK
  can block the update. Test is RED without the policy → GREEN with it.

**FIX 2 — WARNING 3: storage policies assertion no longer fragile**
- Replaced `policies_are('storage','objects', array[...4...], ...)` with four individual
  `ok(exists(select 1 from pg_policies where policyname = '...'), ...)` assertions.
  Adding a future bucket's policies won't cause false failures.

**FIX 3 — SUGGESTION 1: R3 runtime INSERT rejection now tested**
- Added `throws_ok` (error code `23502`) for INSERT omitting `charged_to_owner`.
  Spec scenario "insert without charged_to_owner is rejected" is now covered at runtime.

**FIX 4 — SUGGESTION 2: 030_rls_enabled.test.sql includes property_expenses**
- Added one assertion to `030_rls_enabled.test.sql` (plan: 5 → 6) confirming
  `nodo_inmo.property_expenses` has RLS enabled. Consistent with the file's stated scope.

**FIX 5 — WU7: real integration test for R18 / R19**
- New file: `supabase/tests/integration/storage-cross-tenant.integration.test.ts`
- Uses supabase-js + postgres package against the live local stack.
- Provisions real users + orgs + memberships; the custom_access_token_hook fires and
  injects org_id/role into JWT app_metadata on sign-in.
- Tests: hook fires correctly, admin A upload succeeds, admin A signed URL works,
  admin B signed URL for org A object is denied, public URL returns 400.
- Result: **7/7 PASS** on local stack (2026-06-04).
- Guard: exits 0 with SKIP if stack not running.
- Run: `~/.nvm/versions/node/v22.22.0/bin/node node_modules/.bin/tsx supabase/tests/integration/storage-cross-tenant.integration.test.ts`

**pgTAP suite after fixes:**
- `030_rls_enabled.test.sql`: 6/6 GREEN
- `140_property_expenses.test.sql`: 40/40 GREEN
- `130_caja_posting.test.sql`: 2/8 FAIL (pre-existing isolation issue, not introduced here)
- All other files: GREEN (unchanged)

---

## Blockers / open for PR 2

- None. PR 1 is self-contained and all tests pass.
- WU4–WU5 (hooks + form) depend on merged/applied types — PR 2 scope.
- WU6 (CONVENTIONS.md) — PR 2 scope.
- WU7 (storage cross-tenant check) — COMPLETED via integration test.
- WU8 (remote deploy) — human action required.

---

## Run pgTAP (after `supabase start`)

```bash
/opt/homebrew/bin/supabase test db
```

Expected: `140_property_expenses.test.sql ... ok` (36/36 pass).

## Pre-existing test failures (NOT introduced by this change)

`130_caja_posting.test.sql` fails tests 1–2 ("no cash_movements before any cobro",
"no settlements before any cobro") because test 120 seeds movements that persist
across test file runs in the shared DB. This is a test isolation issue that predates
this change and is unrelated.
