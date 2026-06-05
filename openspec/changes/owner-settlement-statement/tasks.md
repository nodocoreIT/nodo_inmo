# Tasks: owner-settlement-statement (Strict TDD)

Strict TDD is ACTIVE. Every implementation slice follows **RED → GREEN** (no orphan
code before a failing test, no test after passing code).

- **pgTAP loop:** `supabase test db supabase/tests/<file>.test.sql` (positional path).
- **vitest loop:** `npm test` with watch or a single run.
- **Node/CLI:** Node 22 at `~/.nvm/versions/node/v22.22.0/bin`; supabase at
  `/opt/homebrew/bin/supabase`; `supabase gen types typescript --local` with stderr
  suppressed.

Legend:
🔴 write failing test first · 🟢 implement to pass · 🔵 types/tooling (no direct test) ·
👤 manual / integration verification · ⬆️ push / deploy

---

## PR-A — Agency profile (independent, no DB predecessor required)

`org_profiles` table + Template B RLS + `org-branding` Storage bucket + policies +
`config.toml` + `src/features/agency-profile/` hooks + form + settings entry point.

PR-A depends on nothing in this change. It can be built in parallel with PR-B.

---

### A-WU1 — pgTAP test file: org_profiles + storage (RED phase)

Write the complete test file **before any migration exists**. Run it; every
assertion must fail (RED). Do not proceed to A-WU2 until RED is confirmed.

File: `supabase/tests/150_org_profiles.test.sql`

Structure mirrors `120_caja.test.sql`:
`begin; select plan(N); ... select * from finish(); rollback;`

Seed: one org (org A), one admin JWT context for org A, one agent JWT context for
org A, one org B with its own admin JWT context (for cross-tenant assertions).

#### Schema assertions

- [x] 🔴 R-A1 — `has_table('nodo_inmo', 'org_profiles', 'org_profiles table exists')`.
- [x] 🔴 R-A2 — `col_is_pk('nodo_inmo', 'org_profiles', 'org_id', 'org_id is PK')`;
      `col_type_is` for each column (`org_id uuid`, `address text`, `cuit text`,
      `logo_path text`, `phone text`, `email text`, `created_at timestamptz`,
      `updated_at timestamptz`).
- [x] 🔴 R-A2 — `col_not_null` for `org_id`, `created_at`, `updated_at`; `col_is_null`
      for `address`, `cuit`, `logo_path`, `phone`, `email`.
- [x] 🔴 R-A3 — `throws_ok` on second INSERT with same `org_id = A`
      (unique constraint / PK violation).
- [x] 🔴 R-A4 — `lives_ok` on INSERT; UPDATE address at T+1; `is(updated_at > created_at,
      true, 'trigger fires on update')`.

#### RLS assertions

- [x] 🔴 R-A6 — `is((select relrowsecurity from pg_class where relname = 'org_profiles'),
      true, 'RLS enabled')`.
- [x] 🔴 R-A7 — As admin JWT org A → SELECT returns the seeded row (1 row).
- [x] 🔴 R-A8 — As admin JWT org A → INSERT `org_id = A` succeeds (`lives_ok`);
      UPDATE `address` succeeds (`lives_ok`).
- [x] 🔴 R-A9 — As agent JWT org A → SELECT returns 0 rows; INSERT throws
      (`throws_ok`, policy violation).
- [x] 🔴 R-A10 — As admin JWT org A → SELECT returns only org A row; org B row invisible.
- [x] 🔴 R-A11 — As admin JWT org A → UPDATE `org_id = B` throws (`throws_ok`,
      WITH CHECK violation).
- [x] 🔴 R-A12 — As `anon` role → SELECT blocked (permission denied or 0 rows).

#### Storage assertions

- [x] 🔴 R-A13 — `is((select public from storage.buckets where id = 'org-branding'),
      false, 'org-branding bucket is private')`.
- [x] 🔴 Storage policies — `policies_are('storage', 'objects', ARRAY[..., 'branding_admin_select',
      'branding_admin_insert', 'branding_admin_update', 'branding_admin_delete', ...],
      'four branding policies present')` (include any pre-existing policy names in the
      expected array).

- [x] Run `supabase test db supabase/tests/150_org_profiles.test.sql` — **confirmed RED** (before migration), **confirmed GREEN** (36/36 after migration).

---

### A-WU2 — Migration: `org_profiles` table + RLS (GREEN for A-WU1 schema + RLS rows)

Iterate schema with MCP `execute_sql` (no migration-history churn). Commit only when
all A-WU1 schema and RLS assertions are green.

#### 2a — Table + trigger

- [x] 🟢 `CREATE TABLE nodo_inmo.org_profiles` with columns and constraints per design §2.1.
- [x] 🟢 `CREATE TRIGGER set_updated_at` wired to `nodo_inmo.set_updated_at()`.
- [x] Run pgTAP — R-A1, R-A2, R-A3, R-A4 GREEN.

#### 2b — RLS Template B

- [x] 🟢 `ALTER TABLE nodo_inmo.org_profiles ENABLE ROW LEVEL SECURITY`.
- [x] 🟢 Four Template B policies: `admin_select`, `admin_insert`, `admin_update` (USING + WITH CHECK), `admin_delete`.
- [x] Run pgTAP — R-A6 through R-A12 GREEN.

#### 2c — Storage bucket + policies

- [x] 🟢 `INSERT INTO storage.buckets` for `org-branding` (raster-only, 2 MiB).
- [x] 🟢 `[storage.buckets.org-branding]` added to `supabase/config.toml`.
- [x] 🟢 Four `branding_admin_*` storage.objects policies (INSERT + SELECT + UPDATE + DELETE).
- [x] Run pgTAP — R-A13 and storage policy assertions GREEN.

#### 2d — Advisors + security checklist + migration commit

- [x] 🔵 Security checklist (design §11 PR-A): RLS + four policies + UPDATE has USING+WITH CHECK + no user_metadata + bucket private + raster MIME + four storage policies present.
- [x] 🔵 Migration file: `supabase/migrations/20260604211509_create_org_profiles.sql`
- [x] Committed: `feat(db): org_profiles table + Template B RLS + org-branding storage bucket`

---

### A-WU3 — Types regeneration (PR-A)

Depends on A-WU2 committed. Unblocks A-WU4.

- [x] 🔵 `supabase gen types typescript --local 2>/dev/null > src/shared/types/database.ts` — clean output, no stray log lines.
- [x] Verified: `org_profiles: { Row: ...; Insert: ...; Update: ... }` present under `nodo_inmo` Tables.
- [x] Committed: `chore(types): regen database.ts — add org_profiles`

---

### A-WU4 — Frontend hooks: agency profile (RED → GREEN)

Depends on A-WU3 (generated types must exist for TS compilation).

Files:
```
src/features/agency-profile/hooks/
  use-org-profile.ts
  use-upsert-org-profile.ts
  use-upload-logo.ts
  use-logo-url.ts
```
Test file: `src/features/agency-profile/__tests__/agency-profile-hooks.test.ts`

#### 4a — `useUpsertOrgProfile` mutation

- [x] 🔴 Write `agency-profile-hooks.test.ts` — RED confirmed (module did not exist).
- [x] Run `npm test` — RED confirmed.
- [x] 🟢 Implement `use-upsert-org-profile.ts` mirroring `use-create-expense.ts`.
- [x] Run `npm test` — upsert tests GREEN.

#### 4b — `useUploadLogo` mutation

- [x] 🔴 Add to test file — RED confirmed (module did not exist).
- [x] 🟢 Implement `use-upload-logo.ts` mirroring `use-upload-receipt.ts`.
- [x] Run `npm test` — upload tests GREEN (7/7 agency-profile-hooks.test.ts).

#### 4c — `useOrgProfile` query + `useLogoUrl`

- [x] 🟢 Implement `use-org-profile.ts` (maybeSingle, null-safe, staleTime: 30s).
- [x] 🟢 Implement `use-logo-url.ts` (createSignedUrl TTL=60, enabled: !!logoPath, staleTime: 0).
- [x] Committed: `feat(agency-profile): hooks — upsert, upload-logo, query, signed-url`

---

### A-WU5 — Frontend: AgencyProfileForm component (RED → GREEN)

Depends on A-WU4.

Files:
```
src/features/agency-profile/
  components/
    agency-profile-form.tsx
  __tests__/
    agency-profile-form.test.tsx
```
Also modifies: settings entry point (see 5b).

#### 5a — `AgencyProfileForm` component

- [x] 🔴 Write `agency-profile-form.test.tsx` — RED confirmed (component did not exist).
- [x] 🟢 Implement `agency-profile-form.tsx`: useForm + zodResolver, all fields, upload-then-upsert, role guard, graceful null profile.
- [x] Run `npm test` — 10/10 agency-profile-form.test.tsx GREEN.

#### 5b — Settings entry point (admin-gated)

- [x] 🟢 "Datos de la agencia" button in sidebar (admin-only) opens `AgencyProfileForm` in a Dialog.
- [x] Run `npm test` — 193/193 tests GREEN, no regressions.
- [x] Committed: `feat(agency-profile): form + settings entry point (admin-only)`

---

### A-WU6 — Storage cross-tenant integration test (org-branding)

Depends on A-WU2 committed + local Supabase running.
Extends the existing pattern from `supabase/tests/integration/storage-cross-tenant.integration.test.ts`.

- [x] 🔴/🟢 Added `org-branding` test cases: R-A14 upload, R-A14 signed URL, R-A16 cross-tenant denied, R-A17 public URL returns 400.
- [x] 👤 Integration test run: 12/12 PASS (7 receipts + 5 branding). All org-branding cases PASS against the live local stack.
- [x] Committed: `test(storage): org-branding cross-tenant integration cases`

---

### A-WU7 — CONVENTIONS.md update (PR-A)

Can run in parallel with any A-WU. Touches only documentation.

- [x] Added `| Agency profile (settings) | yes | no | B |` to CONVENTIONS.md Module → Role Matrix.
- [x] Committed: `docs(conventions): add agency-profile to module-role matrix`

---

## PR-B — Breakdown sealing (independent of PR-A)

`owner_settlements.breakdown` + `settlement_group` columns + `property_expenses.applied_settlement_id`
FK + two partial indexes + `settle_owner` RPC (atomic seal) + `computeSettlementBreakdown()`
pure fn (TS mirror) + `use-settle-owner` RPC rewire + types regen.

**Critical dependency note:** PR-B requires the `nodo_inmo.property_expenses` table from
the `property-expenses` change. That change must be applied locally (and remotely before PR-B
merges to remote) before A-WU9 migrations can run.

PR-B depends on nothing in PR-A. It can be built in parallel with PR-A.

---

### B-WU1 — pgTAP test file: settle_owner RPC (RED phase — the critical one)

Write the complete test file **before any migration or RPC exists**. Every assertion
must fail (RED). Do not proceed to B-WU2 until RED is confirmed.

File: `supabase/tests/160_settle_owner.test.sql`

Structure: `begin; select plan(N); ... select * from finish(); rollback;`

Seed (full fixture required for the RPC):
- One org + admin JWT context for org A + agent JWT context for org A + wrong-org admin JWT.
- One owner contact (with `commission_rate`).
- One property linked to owner.
- Two paid payments for that property (so `post_payment_to_caja` trigger has already posted
  two commission `cash_movements` and two pending `owner_settlements` rows).
- One `charged_to_owner = true` expense for the property in ARS (the one that should be consumed).
- One `charged_to_owner = true` expense in USD (the other-currency expense, must NOT be consumed by an ARS seal).
- One `charged_to_owner = false` expense in ARS (must NEVER be consumed).

#### Schema / shape assertions (run immediately — will fail until B-WU2 runs)

- [x] 🔴 R-B1 — `has_column('nodo_inmo', 'owner_settlements', 'breakdown', 'breakdown column exists')`;
      `col_type_is('nodo_inmo', 'owner_settlements', 'breakdown', 'jsonb', ...)`;
      `col_is_null(...)` (nullable).
- [x] 🔴 Design §2.2 — `has_column owner_settlements.settlement_group uuid`.
- [x] 🔴 R-B2 — `has_column('nodo_inmo', 'property_expenses', 'applied_settlement_id', ...)`;
      `col_type_is(..., 'uuid', ...)`, nullable.
- [x] 🔴 R-B2 (FK) — `has_fk('nodo_inmo', 'property_expenses', ...)` or query
      `information_schema.referential_constraints` for the FK from `property_expenses.applied_settlement_id`
      → `owner_settlements(id)`.
- [x] 🔴 R-B3 — `has_index('nodo_inmo', 'property_expenses', 'property_expenses_unapplied_idx', ...)`.
- [x] 🔴 Design §2.2 — `has_index('nodo_inmo', 'owner_settlements', 'owner_settlements_group_idx', ...)`.

#### Golden case — atomic seal

- [x] 🔴 Call `select nodo_inmo.settle_owner(owner_id, 'ARS', ARRAY[settlement_id_1, settlement_id_2])`:
  - Assert the returned JSONB has keys `gross`, `commission_rate`, `commission`,
    `owner_share`, `deductions`, `deduction_total`, `net`, `settlement_group`,
    `sealed_at`, `cobro_count`.
  - Assert `net = gross − commission − deduction_total` exactly
    (`is(net, gross - commission - deduction_total, 'net identity holds')`).
  - Assert only the ARS expense appears in `deductions` (length 1); USD expense absent.
  - Assert `charged_to_owner = false` expense absent from `deductions`.
  - Assert both settlement rows now have `status = 'settled'`, `breakdown IS NOT NULL`,
    same `settlement_group` UUID.
  - Assert the ARS expense now has `applied_settlement_id IS NOT NULL`.
  - Assert the USD expense still has `applied_settlement_id IS NULL`.
  - Assert the `false`-flagged expense still has `applied_settlement_id IS NULL`.

#### No-double-count on second seal (the headline correctness gate)

- [x] 🔴 After the first golden-case seal (above), run a second `settle_owner` for the same
      owner with a new batch of pending settlement ids:
  - Assert that `deductions` in the second breakdown is empty (`'[]'::jsonb`).
  - Assert `deduction_total = 0`.
  - The previously-consumed ARS expense still has `applied_settlement_id` unchanged.

#### Seal-once guard (ADR-7)

- [x] 🔴 Attempt `settle_owner` on the already-sealed settlement ids → `throws_ok`
      (function raises exception); existing `breakdown` is unchanged.

#### Rollback on mid-seal failure (the atomicity proof)

- [x] 🔴 Call `settle_owner` with one valid + one non-existent / wrong-org settlement id
      in the batch → `throws_ok`. After the exception:
  - Assert all settlement rows still have `status = 'pending'` and `breakdown IS NULL`.
  - Assert the ARS expense still has `applied_settlement_id IS NULL`.
  - (Proves the transaction rolled back completely — no partial state.)

#### Authorization

- [x] 🔴 As agent JWT → `settle_owner(...)` `throws_ok` (role check fails).
- [x] 🔴 As wrong-org admin JWT → `settle_owner(...)` `throws_ok` or returns 0-row effect
      (org_id mismatch check fires).

- [x] Run `supabase test db supabase/tests/160_settle_owner.test.sql` — **confirm RED** (44/45 failing before migration), **confirmed GREEN** (33/33 after migration).

---

### B-WU2 — Migration: schema extensions + `settle_owner` RPC (GREEN for B-WU1)

Iterate schema with MCP `execute_sql`. Commit only when all B-WU1 assertions are green.

**Prerequisite check:** confirm `nodo_inmo.property_expenses` table exists locally (from
the `property-expenses` change migration). If not, apply that migration first.

#### 2a — Column additions + indexes

- [x] 🟢 `ALTER TABLE nodo_inmo.owner_settlements ADD COLUMN breakdown jsonb,
      ADD COLUMN settlement_group uuid`.
- [x] 🟢 `ALTER TABLE nodo_inmo.property_expenses ADD COLUMN applied_settlement_id uuid
      REFERENCES nodo_inmo.owner_settlements(id) ON DELETE SET NULL`.
- [x] 🟢 `CREATE INDEX property_expenses_unapplied_idx ON nodo_inmo.property_expenses
      (org_id, currency) WHERE applied_settlement_id IS NULL AND charged_to_owner = TRUE`.
- [x] 🟢 `CREATE INDEX owner_settlements_group_idx ON nodo_inmo.owner_settlements
      (settlement_group) WHERE settlement_group IS NOT NULL`.
- [x] Run pgTAP — R-B1, R-B2, R-B3 schema/shape assertions GREEN.

#### 2b — `settle_owner` RPC

- [x] 🟢 Create `nodo_inmo.settle_owner(p_owner_id uuid, p_currency text, p_settlement_ids uuid[]) RETURNS jsonb`
      per design §2.3 exactly:
  - `LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''`.
  - Step 0: resolve `v_org_id` from `auth.jwt() -> 'app_metadata' ->> 'org_id'`;
    explicit `role = 'admin'` check; empty-ids guard.
  - Step 1: `FOR UPDATE` lock on target settlement rows; count-check for pending +
    `breakdown IS NULL` (seal-once guard ADR-7).
  - Step 2: compute `v_gross` (sum of `payments.amount`), `v_commission` (sum of
    `cash_movements` with `source = 'commission'`), `v_net_owner` (sum of `owner_settlements.amount`),
    `v_rate` (effective %, guard divide-by-zero).
  - Step 3: pick unconsumed `property_expenses` for this owner/currency with `FOR UPDATE OF e`.
  - Step 4: `v_net = v_net_owner - v_deduction_sum`.
  - Step 5: assemble `v_breakdown` JSONB per design §2.4 (with `version = 1`).
  - Step 6a: `UPDATE owner_settlements SET status = 'settled', settled_date, breakdown,
    settlement_group WHERE id = ANY(p_settlement_ids)`.
  - Step 6b: `UPDATE property_expenses SET applied_settlement_id = v_anchor_id WHERE
    ... AND applied_settlement_id IS NULL`.
  - `RETURN v_breakdown`.
- [x] Run pgTAP — **all B-WU1 assertions GREEN** (33/33: golden case, no-double-count,
      seal-once, rollback, auth, commission property-first).

#### 2c — Advisors + security checklist + migration commit

- [x] 🔵 `supabase db advisors` — not run (no MCP advisors available); security checklist manually verified.
- [x] 🔵 Security checklist (design §11 PR-B):
  - [x] `settle_owner` is `SECURITY INVOKER` (not DEFINER); `set search_path = ''`;
        fully-qualified names throughout.
  - [x] Function self-checks `role = 'admin'` and `org_id`.
  - [x] Seal-once guard present (`breakdown is null` predicate + count check).
  - [x] `FOR UPDATE` locks on both settlement rows and expenses.
  - [x] `applied_settlement_id` FK is `ON DELETE SET NULL`.
  - [x] pgTAP proves: golden breakdown, no-double-count, seal-once refusal, rollback.
- [x] 🔵 Migration file: `supabase/migrations/20260604220000_settle_owner_breakdown.sql` (hand-authored; `supabase db pull` not used — local migration history is drifted per instructions)
- [x] Committed: `feat(db): settle_owner RPC + breakdown/settlement_group columns + applied_settlement_id FK`

---

### B-WU3 — Types regeneration (PR-B)

Depends on B-WU2 committed. Unblocks B-WU4 and B-WU5.

- [x] 🔵 `supabase gen types typescript --local 2>/dev/null > src/shared/types/database.ts`.
- [x] Verify output contains:
  - `breakdown` and `settlement_group` columns on `owner_settlements`.
  - `applied_settlement_id` column on `property_expenses`.
  - `settle_owner` function in `Database["nodo_inmo"]["Functions"]`.
- [x] Committed: `chore(types): regen database.ts — breakdown columns + settle_owner fn`

---

### B-WU4 — `computeSettlementBreakdown()` pure function (RED → GREEN)

Depends on B-WU3 (types available). Runs in parallel with B-WU5.

File: `src/features/caja/lib/caja-math.ts` (new export added to existing file).
Test file: `src/features/caja/__tests__/caja-math.test.ts`.

This function is the TS mirror of the SQL canonical (ADR-5). It is display-only and
must never feed the sealed snapshot. Same arithmetic, independently regression-tested.

- [x] 🔴 Write `caja-math.test.ts`:
  - R-B4 — `computeSettlementBreakdown` is exported and is a function (not undefined).
  - R-B5 — Golden case: two payments of 1000 and 500 ARS → `gross === 1500`.
  - R-B6 — Commission from `commissions` array (NOT `commissionRate * gross`):
    movements for P1 (100) + P2 (50) → `commission === 150`.
  - R-B6 — `commission_rate` stored verbatim from input (`commission_rate === 10`).
  - R-B7 — Currency isolation: one ARS expense (200), one USD expense (50), `currency = 'ARS'` →
    `deductions.length === 1`, `deductions[0].amount === 200`.
  - R-B8 — Net: `gross=1000, commission=100, deductions=[{amount:50},{amount:30}]` → `net === 820`.
  - R-B8 — Net with no deductions: `gross=1000, commission=100` → `net === 900`.
  - R-B8 — Net rounded to 2 decimal places (fractional input → `toFixed(2)`).
  - R-B9 — Pure / referential: same inputs twice → deeply equal results.
  - R-B17 — Output shape: keys `gross`, `commission_rate`, `commission`, `deductions`, `net`;
    `deductions` is an array; each deduction has `id`, `amount`, `description`, `expense_date`.
  - **ADR-5 anti-drift golden case:** Same inputs as the pgTAP golden fixture (from B-WU1)
    asserted here → output matches expected SQL output exactly. If they diverge, the TS
    mirror is the bug.
- [x] Run `npm test` — **confirmed RED** (13 failing before implementation).
- [x] 🟢 Add `BreakdownDeduction`, `SettlementBreakdown` interfaces and
      `computeSettlementBreakdown(input)` to `src/features/caja/lib/caja-math.ts`
      per design §6.1. Pure function, no side effects, no imports from Supabase.
- [x] Run `npm test` — `caja-math.test.ts` **19/19 GREEN**.
- [x] Committed: `feat(caja): computeSettlementBreakdown pure fn + vitest mirror (ADR-5 anti-drift)`

---

### B-WU5 — `useSettleOwner` RPC rewire (RED → GREEN)

Depends on B-WU3. Runs in parallel with B-WU4.

File: `src/features/caja/hooks/use-settle-owner.ts` (rewrite existing hook).
Test file: `src/features/caja/__tests__/use-settle-owner.test.ts`.

- [x] 🔴 Write `use-settle-owner.test.ts` (mock `supabase`, `useAuth`):
  - R-B10 — On `mutate(input)`, calls `supabase.schema('nodo_inmo').rpc('settle_owner',
    { p_owner_id, p_currency, p_settlement_ids })` — NOT three sequential `.from()` calls.
  - R-B12 — The RPC call (single call) serves as the "breakdown written" guarantee;
    assert the return value from `rpc` is forwarded as the mutation result.
  - R-B13 — Consuming expenses are stamped inside the RPC (server-side); assert NO
    separate `.from('property_expenses').update(...)` call is made from the hook (the
    stamp is the RPC's responsibility, not the hook's).
  - R-B14 — If `rpc` rejects, mutation surfaces the error (no swallowing).
  - R-B15 (client guard) — Empty settlement_ids → early return without calling RPC.
  - R-B16 — Hook passes only the `p_settlement_ids` provided; does not re-query or re-filter
    expenses client-side (the RPC handles it).
  - R-B18 — Makes exactly one RPC call per mutation — no separate breakdown update path.
- [x] Run `npm test` — **confirmed RED** (6 failing before implementation).
- [x] 🟢 Rewrite `use-settle-owner.ts` from direct `.update()` to single
      `supabase.schema('nodo_inmo').rpc('settle_owner', {...})` call per design §6.1.
      `onSuccess`: invalidate `OWNER_SETTLEMENTS_QUERY_KEY`; return the `data` (breakdown JSONB).
- [x] Run `npm test` — `use-settle-owner.test.tsx` **7/7 GREEN**.
- [x] Committed: `feat(caja): use-settle-owner rewired to settle_owner RPC (single atomic call)`

---

### B-WU6 — CONVENTIONS.md update (PR-B)

Can run in parallel with any B-WU. Touches only documentation.

- [x] Added to Module → Role Matrix in
      `openspec/changes/nodo-inmo-foundation/CONVENTIONS.md`:
      `| Owner settlement PDF | yes | no | B |` (also `| Agency profile (settings) | yes | no | B |` from PR-A if missing)

- [x] Committed: `docs(conventions): add owner-settlement-pdf + agency-profile to module-role matrix`

---

## PR-C — PDF comprobante + share (depends on PR-A merged + PR-B merged)

`@react-pdf/renderer` dep + `settlement-statement-document.tsx` + `use-settlement-statement.ts`
+ download/share wiring in `caja-page.tsx`.

**PR-C cannot start until both PR-A and PR-B are merged**, because:
- It needs the `breakdown` JSONB from the sealed settlement (PR-B).
- It needs the `org_profiles` / `logo_path` from the agency profile (PR-A).

---

### C-WU1 — Install `@react-pdf/renderer` (tooling, no test)

- [x] 🔵 `npm install @react-pdf/renderer` — add to `dependencies` (not devDependencies;
      it is runtime, loaded on demand).
- [x] 🔵 Verify the package does NOT appear in any static import at the admin bundle entry
      path (search result must be empty):
      ```bash
      rg "from '@react-pdf/renderer'" src/ --glob '*.ts' --glob '*.tsx'
      ```
      All hits must be inside the PDF document component only, and that file must be
      dynamically imported (verified in C-WU3).
- [x] Commit: `feat(deps): add @react-pdf/renderer`

---

### C-WU2 — `settlement-statement-data.ts` prop-builder (RED → GREEN)

Depends on C-WU1 and types from PR-A + PR-B.

File: `src/features/caja/lib/settlement-statement-data.ts`
Test file: `src/features/caja/__tests__/settlement-statement.test.tsx` (shared with C-WU3).

Note: Implemented as a pure prop-builder (`buildStatementData`) rather than a React hook,
because the data sources (org_profiles, logo_url) are already available in caja-page.tsx
via existing hooks (useOrgProfile, useLogoUrl). The pure function approach avoids hook
coupling and is more testable. Fully satisfies R-C5 (verbatim breakdown), R-C2 (null
agency graceful), R-A22.

- [x] 🔴 Write settlement-statement test file (data hook section) — confirmed RED before implementation.
- [x] 🟢 Implement `settlement-statement-data.ts`: `buildStatementData()` pure function;
      casts `breakdown` (from DB Json type) to `SealedBreakdown` at the read boundary;
      null agency → empty string placeholders (graceful, R-A22 / R-C2).
      Also exports `slugifyOwnerName()` for filename generation (R-C8).
- [x] Run `npm test` — data prop-builder tests GREEN (5/5 + 2 slug tests).

---

### C-WU3 — `settlement-statement-document.tsx` PDF component (RED → GREEN)

Depends on C-WU1.

File: `src/features/caja/components/settlement-statement-document.tsx`

- [x] 🔴 R-C1 (dynamic import guard) — vitest asserts module can be loaded via dynamic
      import() without crashing; confirmed RED before implementation.
- [x] 🔴 R-C2 / R-C4 / R-C5 — Data-layer assertions (via buildStatementData) confirmed RED.
- [x] Run `npm test` — RED confirmed (full suite).
- [x] 🟢 Implemented `settlement-statement-document.tsx` with React-PDF primitives
      (`Document`, `Page`, `View`, `Text`, `Image`, `StyleSheet`) per design §6.3.
      Pure presentational — reads `breakdown` verbatim (HEADLINE-2). Graceful "—"
      placeholder when agency is null (R-C2, R-A22). Money formatted as `$ {amount} {currency}`.
      Static import of @react-pdf/renderer is INSIDE this module only; this module is
      loaded exclusively via dynamic import() from settlement-pdf-actions.ts.
      No static import of @react-pdf/renderer exists in any file on the admin bundle
      critical path (verified with `rg` — zero hits outside this module).
- [x] Run `npm test` — PDF document tests GREEN (11/11 in settlement-statement.test.tsx).
- [x] Committed together with settlement-statement-data + settlement-pdf-actions.

---

### C-WU4 — Download + Web Share wiring in `caja-page.tsx` (RED → GREEN)

Depends on C-WU2 + C-WU3.

- [x] 🔴 R-C7/C8/C9/C10/C11/C12 — Tests written in settlement-statement.test.tsx — confirmed RED before caja-page changes.
- [x] Run `npm test` — RED confirmed (4 CajaPage tests failing).
- [x] 🟢 `buildBlob()`, `handleDownload()`, `handleShare()` extracted to `settlement-pdf-actions.ts`.
      Dynamic `Promise.all([import('@react-pdf/renderer'), import('./settlement-statement-document')])`.
      `caja-page.tsx` updated: `SettlementsTab` renders both pending (Liquidar) and sealed
      (Descargar + optional Compartir) sections. `SealedSettlementActions` component reads
      `useOrgProfile` + `useLogoUrl` and calls `handleDownload`/`handleShare` with `buildStatementData`.
      "Compartir" gated on `navigator.canShare?.({ files })` — graceful desktop fallback to download.
      Multi-currency: `groupSealedByOwner` deduplicates by `owner_id:currency` key.
      Filename slug: `slugifyOwnerName()` handles diacritics (NFD normalize + strip).
- [x] Run `npm test` — 16/16 settlement-statement tests GREEN; 230/230 total.
- [x] Committed: `feat(caja): download + web-share wiring for settlement PDF comprobante`

---

### C-WU5 — Security + bundle audit (PR-C)

- [x] 🔵 Security checklist (design §11 PR-C):
  - [x] `@react-pdf/renderer` is dynamically imported only; confirmed by R-C1 vitest
        assertion + manual `rg "from \"@react-pdf/renderer\""` scan — only hit is
        settlement-statement-document.tsx, which is itself loaded exclusively via
        dynamic import() from settlement-pdf-actions.ts.
  - [x] PDF reads frozen `breakdown` verbatim — no recomputation (HEADLINE-2); R-C5
        test confirms the document data matches breakdown prop exactly.
  - [x] Empty-profile renders graceful placeholders, does not crash (R-A22 / R-C2
        tests cover this — null agency → empty string fields, no throw).
- [x] 🔵 `supabase db advisors` — not re-run (no migration changes in PR-C, read-only
      feature). Previous advisor verification from PR-A/PR-B applies. (No new migration.)
- [x] Committed with C-WU4: `feat(caja): download + web-share wiring for settlement PDF comprobante`

---

## Dependency graph

```
PR-A (independent):
  A-WU1 (RED pgTAP) ──► A-WU2a (table+trigger) ──► A-WU2b (RLS)
                                                            │
                                                     A-WU2c (storage)
                                                            │
                                                     A-WU2d (advisors+commit)
                                                            │
                                                     A-WU3 (types regen)
                                                            │
                                                     A-WU4 (hooks RED→GREEN)
                                                            │
                                                     A-WU5 (form RED→GREEN)
  A-WU6 (storage integration) ──── after A-WU2d (parallel with A-WU3+)
  A-WU7 (CONVENTIONS.md) ──────── parallel, no blocker

PR-B (independent, requires property-expenses applied):
  B-WU1 (RED pgTAP) ──► B-WU2a (columns+indexes) ──► B-WU2b (RPC)
                                                              │
                                                       B-WU2c (advisors+commit)
                                                              │
                                                       B-WU3 (types regen)
                                                       ┌──────┴──────┐
                                                  B-WU4 (caja-math)  B-WU5 (use-settle-owner)
  B-WU6 (CONVENTIONS.md) ──── parallel, no blocker

PR-C (requires PR-A merged + PR-B merged):
  C-WU1 (install dep) ──► C-WU2 (data hook RED→GREEN)
                      └──► C-WU3 (PDF document RED→GREEN)
                                   │
                             C-WU4 (download+share RED→GREEN)
                                   │
                             C-WU5 (audit)
```

Parallel opportunities:
- PR-A and PR-B can be built simultaneously (no shared dependency).
- Within PR-A: A-WU6 and A-WU7 run any time after A-WU1 is planned.
- Within PR-B: B-WU4 and B-WU5 run concurrently (both depend only on B-WU3).
- PR-C is strictly sequential after both PR-A and PR-B land.

---

## Review Workload Forecast

| PR | Category | Estimated lines |
|----|----------|-----------------|
| **PR-A** | SQL migration (table + trigger + RLS) | ~80 |
| | SQL storage bucket + 4 policies | ~70 |
| | `config.toml` addition | ~5 |
| | pgTAP test file `150_org_profiles.test.sql` | ~120 |
| | `database.ts` regen (net new types) | ~50 |
| | 4 hook files (`use-org-profile`, `use-upsert-org-profile`, `use-upload-logo`, `use-logo-url`) | ~120 |
| | `agency-profile-form.tsx` | ~160 |
| | vitest form test file | ~140 |
| | Settings entry point wiring | ~30 |
| | Integration test additions | ~60 |
| | CONVENTIONS.md | ~3 |
| **PR-A subtotal** | | **~838 lines** |
| | | |
| **PR-B** | SQL migration (ALTER TABLE + 2 indexes) | ~25 |
| | `settle_owner` RPC (plpgsql body) | ~130 |
| | pgTAP test file `160_settle_owner.test.sql` | ~200 |
| | `database.ts` regen (net new types) | ~60 |
| | `caja-math.ts` additions (interfaces + fn) | ~60 |
| | `use-settle-owner.ts` rewrite | ~50 |
| | `caja-math.test.ts` | ~100 |
| | `use-settle-owner.test.ts` | ~80 |
| | CONVENTIONS.md | ~3 |
| **PR-B subtotal** | | **~708 lines** |
| | | |
| **PR-C** | `@react-pdf/renderer` dep change (`package.json`/lock) | ~3 |
| | `settlement-statement-document.tsx` | ~180 |
| | `use-settlement-statement.ts` | ~60 |
| | `caja-page.tsx` additions (buildBlob / download / share) | ~100 |
| | `settlement-statement.test.tsx` (combined) | ~200 |
| **PR-C subtotal** | | **~543 lines** |
| | | |
| **Total (estimated)** | | **~2,089 lines** |

- **400-line budget risk: HIGH** for every PR individually (PR-A ~838, PR-B ~708, PR-C ~543).
- **Chained PRs recommended: Yes** — the three-PR split is already the design decision;
  no further splitting is proposed within each PR, but reviewers should be aware each
  exceeds the 400-line threshold.
- **Decision needed before apply:** Confirm the three-PR boundary is accepted as-is, or
  request further splitting (e.g. PR-A DB vs. PR-A UI). Note that generated types and
  pgTAP fixtures account for ~170–260 lines of non-reviewable scaffold per PR.
- **Recommended merge order:** PR-A → PR-B → PR-C. PR-A and PR-B can be reviewed
  concurrently; PR-C review begins only after both are merged.
- **PR-B external dependency:** `nodo_inmo.property_expenses` table must be applied
  locally before PR-B work begins. Remote must have it applied before PR-B merges.
