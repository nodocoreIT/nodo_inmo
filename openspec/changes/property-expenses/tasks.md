# Tasks: property-expenses (Strict TDD)

Strict TDD is ACTIVE. Every implementation slice follows **RED → GREEN** (no orphan
code before a failing test, no test after passing code).

- **pgTAP loop:** `supabase test db` against the local Supabase instance.
- **vitest loop:** `npm test` with watch or a single run.

Legend:
🔴 write failing test first · 🟢 implement to pass · 🔵 types/tooling (no direct test) ·
👤 manual verification step · ⬆️ push / deploy

**Bucket name authority:** spec (R15–R20) names the bucket `property-expense-receipts`.
The design §4.1 uses `property-receipts`. The spec is normative; use
`property-expense-receipts` everywhere. This is tracked as Risk 1 below.

---

## Work Unit 1 — DB: pgTAP test file (RED phase)

All pgTAP assertions for this change live in one file. Write the whole file first so
every subsequent implementation step can target a failing assertion.

File: `supabase/tests/140_property_expenses.test.sql`

Structure follows `120_caja.test.sql`: `begin; select plan(N); ... select * from finish(); rollback;`
Seed: one org + admin JWT context + agent JWT context + one property (owned by a contact).

- [x] 🔴 R1 — assert `has_table('nodo_inmo', 'property_expenses', ...)`.
- [x] 🔴 R2 — `col_is_pk`, `col_not_null` for each NOT NULL column; `col_type_is` for
      each column's declared type.
- [x] 🔴 R3 — `col_hasnt_default` (or `col_default_is(..., NULL, ...)`) for
      `charged_to_owner` — proves no column-level default.
- [x] 🔴 R4 — `throws_ok` on INSERT with `amount = 0` and `amount = -1`.
- [x] 🔴 R5 — `throws_ok` on INSERT with `type = 'otro'`.
- [x] 🔴 R6 — `throws_ok` on INSERT with `currency = 'EUR'`.
- [x] 🔴 R7 — `lives_ok` for a valid insert; update description; assert `updated_at >
      created_at` after the UPDATE (trigger fires).
- [x] 🔴 R8 — `is((select relrowsecurity from pg_class ...), true, 'RLS enabled')`.
- [x] 🔴 R9 — `set local role authenticated` + admin JWT → SELECT returns seeded row.
- [x] 🔴 R10 — admin JWT → INSERT succeeds (`lives_ok`).
- [x] 🔴 R11 — agent JWT → SELECT returns 0 rows; INSERT throws (policy violation).
- [x] 🔴 R12 — admin JWT scoped to org A → SELECT returns only org A row (org B row
      seeded but invisible).
- [x] 🔴 R13 — admin JWT → UPDATE setting `org_id = <other_org_id>` is rejected by
      WITH CHECK.
- [x] 🔴 R14 — anon role → SELECT blocked (throws permission denied — stricter than 0
      rows; anon has no USAGE on nodo_inmo schema).
- [x] 🔴 R15 — `is((select public from storage.buckets where id =
      'property-expense-receipts'), false, 'bucket is private')`.
- [x] 🔴 Storage policies — `policies_are(...)` for all four
      `receipts_admin_*` policies on `storage.objects` (used `policies_are` instead
      of `has_policy` — not available in installed pgTAP version).
- [x] 🔴 R26 (ledger isolation) — insert a row; assert `cash_movements` count for the
      org is unchanged.
- [x] 🔴 R27/R28 (deduction view) — assert view `owner_chargeable_expenses` exists;
      insert one `charged_to_owner = true` row and one `false` row; as admin, the view
      returns exactly the `true` row with the correct `owner_id` (from property join);
      as agent, view returns 0 rows (security_invoker preserves Template B).
- [x] Run `supabase test db` — **confirmed RED** before migration, **confirmed GREEN** after.

---

## Work Unit 2 — DB: migration (GREEN phase for pgTAP WU1)

Iterate schema using MCP `execute_sql` (no migration-history churn). Commit only when
all pgTAP assertions for this unit are green.

### 2a — Table + indexes + trigger
- [x] 🟢 `CREATE TABLE nodo_inmo.property_expenses` with all columns, types, constraints,
      and FK references per design §2 (spec R1–R7).
      - `amount numeric(15,2) check (amount > 0)` — spec R4 normative (`> 0`).
      - `charged_to_owner boolean not null` — **no default** (ADR-4).
      - `on delete restrict` on `property_id`; `on delete cascade` on `org_id`.
- [x] 🟢 Create three indexes per design §2 (`property_expenses_org_id_idx`,
      `property_expenses_property_id_idx`, `property_expenses_chargeable_idx` partial
      on `(org_id, expense_date) where charged_to_owner = true`).
- [x] 🟢 Create `set_updated_at` trigger on `nodo_inmo.property_expenses` reusing the
      existing `nodo_inmo.set_updated_at()` function (spec R7).
- [x] Run `supabase test db` — WU1 rows R1–R7 GREEN.

### 2b — RLS Template B
- [x] 🟢 `ALTER TABLE nodo_inmo.property_expenses ENABLE ROW LEVEL SECURITY`.
- [x] 🟢 Create four policies per design §3 / CONVENTIONS.md Template B:
      `admin_select`, `admin_insert`, `admin_update` (with USING + WITH CHECK),
      `admin_delete`. All use `app_metadata` (never `user_metadata`).
- [x] Run `supabase test db` — WU1 rows R8–R14 GREEN.

### 2c — Storage bucket + policies
- [x] 🟢 `INSERT INTO storage.buckets` for `property-expense-receipts` with
      `public = false`, `file_size_limit = 10485760`,
      `allowed_mime_types` per design §4.1.
      Bucket id/name: `property-expense-receipts` (spec normative).
- [x] 🟢 Declared bucket in `supabase/config.toml` under
      `[storage.buckets.property-expense-receipts]` for local dev provisioning.
- [x] 🟢 Created four `storage.objects` policies per design §4.3:
      `receipts_admin_select`, `receipts_admin_insert`, `receipts_admin_update`
      (USING + WITH CHECK), `receipts_admin_delete`. Each scoped by `bucket_id`,
      `(storage.foldername(name))[1]` = JWT `org_id` (text comparison), and
      `role = 'admin'`.
- [x] Run `supabase test db` — R15 + storage policy assertions GREEN.

### 2d — Deduction view (settlement consumption seam)
- [x] 🟢 Created view `nodo_inmo.owner_chargeable_expenses WITH (security_invoker = true)`
      per design §5. Join `property_expenses → properties` on `property_id`. Filter
      `charged_to_owner = true`. Exposes: `expense_id`, `org_id`, `owner_id`,
      `property_id`, `amount`, `currency`, `expense_date`, `type`, `description`.
- [x] Run `supabase test db` — R26–R28 (ledger isolation + deduction view) GREEN.

### 2e — Advisors + migration commit
- [x] 🔵 `supabase db advisors` — no issues found (R29 clean).
- [x] 🔵 Security checklist passed:
      - [x] RLS enabled, four Template B policies present.
      - [x] Every UPDATE policy has USING + WITH CHECK.
      - [x] No policy reads `user_metadata`.
      - [x] Bucket `property-expense-receipts` is `public = false`.
      - [x] Storage INSERT + SELECT + UPDATE + DELETE policies present.
      - [x] View is `security_invoker = true`.
- [x] 🔵 Migration file: `supabase/migrations/20260604110925_create_property_expenses.sql`
      (created with `supabase migration new`, content written directly — `db pull` not
      used because the migration was applied via `psql --file`, not `execute_sql` MCP).
- [x] Commit: `feat(db): property_expenses table + RLS + storage bucket + deduction view`

---

## Work Unit 3 — Types regeneration

Depends on: Work Unit 2 fully committed and migration applied locally.
Runs in parallel with nothing (unblocks WU4).

- [x] 🔵 Regenerate `src/shared/types/database.ts`:
      `supabase gen types typescript --local > src/shared/types/database.ts`
      Verified output contains:
      - `Tables: { property_expenses: { Row: ...; Insert: ...; Update: ... } }` under
        `nodo_inmo`.
      - `Views: { owner_chargeable_expenses: { Row: ... } }` under `nodo_inmo`.
- [x] Commit: `chore(types): regen database.ts — add property_expenses + deduction view`

---

## Work Unit 4 — Frontend: hooks (RED → GREEN)

Depends on: Work Unit 3 (generated types must exist for TS compilation).

File layout:
```
src/features/property-expenses/hooks/
  use-property-expenses.ts
  use-create-expense.ts
  use-upload-receipt.ts
  use-receipt-url.ts
```
Test file: `src/features/property-expenses/__tests__/use-create-expense.test.ts`

### 4a — `useCreateExpense` mutation
- [ ] 🔴 Write `use-create-expense.test.ts` — test cases:
      - Calls `supabase.schema('nodo_inmo').from('property_expenses').insert(...)` with
        correct payload including `org_id` from `useAuth` (spec R10, R24 ordering check).
      - `receipt_path` in the payload is the storage key (no `https://` prefix — spec R20).
      - Throws when `orgId` is absent (no org, no insert).
      - Does NOT call `from('cash_movements')` at any point (spec R26, vitest variant).
- [ ] Run `npm test` — confirm RED (module does not exist yet).
- [ ] 🟢 Implement `use-create-expense.ts` mirroring `use-create-cash-movement.ts`.
      Export `CreateExpenseInput = Omit<PropertyExpenseInsert, 'org_id'>`.
      `onSuccess` invalidates `PROPERTY_EXPENSES_QUERY_KEY`.
- [ ] Run `npm test` — `use-create-expense.test.ts` GREEN.

### 4b — `useUploadReceipt` mutation
- [ ] 🔴 Add tests to the same or a new test file:
      - `supabase.storage.from('property-expense-receipts').upload(key, file, { upsert: true })`
        is called with a key matching the pattern
        `{orgId}/{propertyId}/{uuid}-{filename}` (spec R16, R20, ADR-3 path convention).
      - Returns the object key (not a URL).
      - On upload failure, the returned key is undefined / error is thrown (insert caller
        must not receive a key — spec R24).
- [ ] Run `npm test` — RED.
- [ ] 🟢 Implement `use-upload-receipt.ts`. Key construction:
      `${orgId}/${propertyId}/${crypto.randomUUID()}-${sanitize(file.name)}`.
- [ ] Run `npm test` — GREEN.

### 4c — `usePropertyExpenses` list query + `useReceiptUrl`
- [ ] 🟢 Implement `use-property-expenses.ts` (list query per `property_id`; uses
      `PROPERTY_EXPENSES_QUERY_KEY`). No dedicated unit test required — covered by
      integration-style rendering in WU5 form tests.
- [ ] 🟢 Implement `use-receipt-url.ts` (`createSignedUrl`, 60 s TTL, never
      `getPublicUrl`). No dedicated unit test required.
- [ ] Commit: `feat(property-expenses): hooks — create, upload, list, signed-url`
      (includes test file + all four hook files).

---

## Work Unit 5 — Frontend: form + entry point (RED → GREEN)

Depends on: Work Unit 4 (hooks available for import in component).

Files:
```
src/features/property-expenses/
  components/
    expense-form-dialog.tsx
    register-expense-button.tsx
  lib/
    expense-labels.ts
  __tests__/
    create-expense.test.tsx
```
Also modifies: `src/features/properties/components/properties-list.tsx`

### 5a — `ExpenseFormDialog` component
- [ ] 🔴 Write `create-expense.test.tsx` — mock `supabase`, `useAuth`, Radix `Select`
      (native `<select>` in jsdom, matching `create-property.test.tsx` pattern), and
      `useCreateExpense` / `useUploadReceipt` hooks. Test cases:
      - Spec R21: renders "Registrar gasto" button when `role = 'admin'`; button is
        absent when `role = 'agent'`.
      - Spec R22: `ExpenseFormDialog` renders type selector, amount input, currency
        selector, date input, description textarea, `charged_to_owner` control
        (radio or switch, **not** pre-checked), and file input.
      - Spec R23 — missing amount: submit without amount → validation error, no
        `mutateAsync` call.
      - Spec R23 — zero amount: submit with `0` → validation error shown.
      - Spec R23 — valid submit: all fields filled, `charged_to_owner` explicitly set →
        `useUploadReceipt` called first (if file attached), then `mutateAsync` called
        with correct payload; `receipt_path` is storage key not a URL (R20).
      - Spec R24: upload-then-insert ordering; if `useUploadReceipt` rejects, `mutateAsync`
        is never called.
      - Spec R25: on `mutateAsync` success → success toast appears + dialog is closed.
      - Spec R25: on `mutateAsync` failure → error message visible + dialog stays open.
- [ ] Run `npm test` — confirm RED (components do not exist).
- [ ] 🟢 Implement `expense-labels.ts` — `TYPE_LABELS`, `CURRENCY_LABELS`, `formatAmount`.
- [ ] 🟢 Implement `ExpenseFormDialog` (react-hook-form + zod, shadcn Form/FormField,
      `charged_to_owner` as required radio or Switch with no default). Zod schema per
      design §6. Amount captured as string, coerced to `Number` on submit. Upload-then-
      insert sequence; best-effort object delete on insert error (orphan mitigation).
- [ ] 🟢 Implement `RegisterExpenseButton` (wraps dialog open state, accepts `propertyId`).
- [ ] Run `npm test` — `create-expense.test.tsx` GREEN.

### 5b — Property row entry point
- [ ] 🟢 In `src/features/properties/components/properties-list.tsx`, add a third
      `RowActions` item: "Registrar gasto" — visible only when `role === 'admin'` (from
      `useAuth`). Opens `<ExpenseFormDialog>` with `propertyId` pre-bound (same pattern
      as the existing edit-dialog wiring, per design ADR-5).
- [ ] Run `npm test` — R21 scenarios in `create-expense.test.tsx` must still GREEN after
      this change.
- [ ] Commit: `feat(property-expenses): form dialog + property row entry point`
      (includes form, button, labels, test file, and properties-list change).

---

## Work Unit 6 — CONVENTIONS.md update

Can run in parallel with WU5 (touches only documentation).
Depends on: nothing except WU1 being planned.

- [ ] Add the following row to the Module → Role Matrix in
      `openspec/changes/nodo-inmo-foundation/CONVENTIONS.md`:

      | Property expenses | yes | no | B |

- [ ] Commit: `docs(conventions): add property-expenses to module→role matrix`

---

## Work Unit 7 — Manual verification (storage cross-tenant)

Depends on: WU2 committed + local Supabase running. Runs after WU2e.
Cannot be automated via pgTAP (requires Storage HTTP API — design §8 manual verification).

- [ ] 👤 `supabase start` (if not already running).
- [ ] 👤 As admin of org A: register an expense with a photo via the UI or direct API
      call. Confirm the object lands at `{orgA}/{propertyId}/{uuid}-{filename}` in the
      `property-expense-receipts` bucket.
- [ ] 👤 As admin of org B: attempt `createSignedUrl` on the org A object key → confirm
      the request is denied (RLS policy blocks cross-org read — spec R18).
- [ ] 👤 Confirm bucket is private: request the public URL pattern
      `/storage/v1/object/public/property-expense-receipts/...` without auth → 400 or
      404 (spec R19).
- [ ] Document the manual check outcome as a comment or note in the PR description.

---

## Work Unit 8 — Remote deployment

Depends on: all prior WUs green locally. Human action required.

- [ ] ⬆️ `supabase db push` — apply migration to the shared remote project.
- [ ] 🔵 `supabase gen types typescript --project-id <id>` — confirm remote types match
      local (optional, belt-and-suspenders).
- [ ] 👤 Remote Supabase dashboard: confirm the `property-expense-receipts` bucket exists
      with `public = false`.
- [ ] 🔵 Re-run pgTAP assertions against remote via MCP `execute_sql` (spot-check R8, R15,
      R27/R28 at minimum) to confirm parity with local.
- [ ] Commit (if any remote-only fix was needed): `fix(db): remote deploy corrections`.

---

## Dependency graph

```
WU1 (RED pgTAP) ──► WU2a (table) ──► WU2b (RLS) ──► WU2c (storage)
                                                       │
                                          WU2d (view) ─┘
                                                       │
                                          WU2e (commit) ──► WU3 (types regen)
                                                                    │
                                                          WU4 (hooks RED→GREEN)
                                                                    │
                                                          WU5 (form RED→GREEN)
WU6 (CONVENTIONS.md) ─────────────────────────────── (parallel, no blocker)
WU7 (manual storage check) ───────────────── after WU2e (parallel with WU3+)
WU8 (remote deploy) ──────────────────────────────── after all WUs green
```

Parallel opportunities:
- WU6 can start at any time (doc-only).
- WU7 can start as soon as WU2e is committed.
- WU3 and WU7 can run concurrently.
- WU4 and WU5 are strictly sequential (WU4 hooks must exist before WU5 imports them).

---

## Review Workload Forecast

| Category                              | Estimated lines |
|---------------------------------------|-----------------|
| SQL migration (table + indexes + trigger + RLS + view) | ~120 |
| SQL storage bucket + 4 policies       | ~80 |
| pgTAP test file (WU1)                 | ~200 |
| `database.ts` regen (generated)       | ~60–100 (net new types) |
| 4 hook files                          | ~100 |
| `expense-form-dialog.tsx`             | ~180 |
| `register-expense-button.tsx`         | ~30 |
| `expense-labels.ts`                   | ~20 |
| vitest test file                      | ~150 |
| `properties-list.tsx` modification    | ~20 |
| `config.toml` addition                | ~5 |
| `CONVENTIONS.md` addition             | ~3 |
| **Total (estimated)**                 | **~970–1000 lines** |

- **400-line budget risk: HIGH** — the change roughly triples the single-PR budget.
- **Chained PRs recommended: Yes**
- **Decision needed before apply: Yes**

Suggested PR split (stacked-to-main):

| PR | Work units | Focus | Estimated lines |
|----|------------|-------|-----------------|
| PR 1 | WU1 + WU2 + WU3 | DB foundation: table, RLS, storage bucket, view, types | ~450–500 |
| PR 2 | WU4 + WU5 + WU6 + WU7 (documented) | Frontend hooks, form, entry point, conventions | ~500–550 |

PR 2 depends on PR 1 merging (types regen is the seam). Each PR is independently
reviewable and deployable; PR 1 adds no UI surface and PR 2 requires the DB objects
to exist at runtime but is safe to merge to main before WU8 if the remote is kept in sync.
