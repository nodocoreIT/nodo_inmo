# Apply Progress: property-expenses — PR 1 (DB + types) + PR 2 (frontend)

**PR 1 Branch:** `feat/property-expenses-db` — DONE
**PR 2 Branch:** `feat/property-expenses-ui` — DONE
**Date PR 2 completed:** 2026-06-04

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

## Work units completed — PR 2 (frontend)

### WU4 — Hooks (RED → GREEN)
- [x] Test file: `src/features/property-expenses/__tests__/use-create-expense.test.tsx` (7 tests)
  - Confirmed RED before hooks existed
  - Confirmed GREEN after implementation
- [x] `use-create-expense.ts` — mutation; `CreateExpenseInput = Omit<PropertyExpenseInsert, 'org_id'>`;
  `onSuccess` invalidates `PROPERTY_EXPENSES_QUERY_KEY`
- [x] `use-upload-receipt.ts` — storage mutation; key = `{orgId}/{propertyId}/{uuid}-{sanitized_filename}`;
  bucket `property-expense-receipts`; upsert:true; returns object key (not URL)
- [x] `use-property-expenses.ts` — list query per `property_id`, newest first
- [x] `use-receipt-url.ts` — `createSignedUrl` (60s TTL, never getPublicUrl)
- [x] Commit: `cb1511f feat(property-expenses): hooks — create, upload, list, signed-url`

### WU5 — Form dialog + property row entry point (RED → GREEN)
- [x] Test file: `src/features/property-expenses/__tests__/create-expense.test.tsx` (10 tests)
  - R21 role visibility (2 tests), R22 field rendering (2 tests), R23 validation (3 tests),
    R24 upload ordering (1 test), R25 success/failure feedback (2 tests)
  - Confirmed RED before components existed; GREEN after
- [x] `expense-labels.ts` — `TYPE_LABELS`, `CURRENCY_LABELS`, `formatAmount`
- [x] `expense-form-dialog.tsx` — react-hook-form + zod; `charged_to_owner` checkbox (no default);
  upload-then-insert sequence; inline error alert on failure (no toast in project yet)
- [x] `register-expense-button.tsx` — role-gated (null if not admin); opens dialog with `propertyId`
- [x] `properties-list.tsx` — `RegisterExpenseButton` added to `RowActions`; `properties-list.test.tsx`
  updated to mock the expense button (isolation)
- [x] Commit: `9130bf5 feat(property-expenses): form dialog + property row entry point`

### WU6 — CONVENTIONS.md update
- [x] Added `| Property expenses | yes | no | B |` to the Module → Role Matrix
- [x] Commit: `d474002 docs(conventions): add property-expenses to module-role matrix`

### Standalone tweak (promised)
- [x] `caja-page.tsx` StatCard label colors (green for Ingresos, red for Egresos)
- [x] Commit: `c6846a8 style(caja): color StatCard labels green/red for income/expense`

### UX + test-fix pass (verify-report-pr2 WARNING 1 + WARNING 2) — 2026-06-04

**FIX 1 — WARNING 1: charged_to_owner radio group**
- Replaced native checkbox with a native Sí/No radio group in `expense-form-dialog.tsx`
- Neither option is pre-selected (ADR-4 — no default); Zod `required_error` blocks submit
  until an explicit choice is made
- `field.onChange(true)` / `field.onChange(false)` guarantee a boolean is always sent
- Also removed `min={0.01}` from the amount `<input type="number">` — the HTML5
  constraint validation was silently swallowing form submits in jsdom (browser native
  validation fires before React's `onSubmit`), preventing the Zod refine error from
  ever rendering. Validation is enforced solely by Zod.
- Commit: `b42bba1 fix(property-expenses): explicit Sí/No radio for charged_to_owner`

**FIX 2 — WARNING 2: zero-amount error visibility**
- `create-expense.test.tsx` zero-amount test now asserts
  `expect(screen.getByText(/mayor a cero/i)).toBeInTheDocument()` in addition
  to the existing `expect(mockMutateAsync).not.toHaveBeenCalled()`
- Added new R23 test: selecting "No" sends `charged_to_owner: false` to the mutation
- Updated all tests referencing the old checkbox to use
  `getByRole("radio", { name: /^sí$|^no$/i })` queries
- Commit: `700e9d1 test(property-expenses): radio assertions + assert zero-amount error is shown`

---

## Vitest results — PR 2 (after UX+test-fix pass)

- Test files: 32 passed (33 total — 1 pre-existing non-vitest integration script)
- Tests: **176 passed / 0 failed** (+1 from new "No" radio path test)
- Lint: 15 problems / 12 errors — baseline unchanged, no new errors introduced
- Typecheck: passes cleanly

---

## Deviations from design in PR 2

| Item | Design/Spec | Applied | Reason |
|------|-------------|---------|--------|
| charged_to_owner UI | radio or Switch | native Sí/No radio group | No Radix Switch installed; radio group is the correct semantic pattern and matches spec intent (ADR-4 explicit choice) — WARNING 1 resolved |
| Success toast | "success toast/notification" | onSuccess callback closes dialog (no toast) | No toast system exists in the project yet; inline error alert for failure |
| orphan object cleanup | best-effort delete on insert error | not implemented | The supabase storage delete call would require a second mutation; left for a follow-up since it's a "best-effort" mitigation per the spec |

---

## Blockers / open items

- WU8 (remote deploy) — human action required.
- Orphan storage object cleanup on insert failure — best-effort, out of scope for now.
- No toast system — success feedback is dialog-close only; a toast can be added when the system-wide notification layer is built.

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
