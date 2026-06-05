# Apply Progress: owner-settlement-statement — PR-A (Agency Profile)

**Change**: owner-settlement-statement  
**Batch**: PR-A (agency profile) — first batch  
**Mode**: Strict TDD (RED → GREEN enforced for every task)  
**Date**: 2026-06-04  
**Branch**: feat/agency-profile  

---

## Completed Tasks

- [x] A-WU1 — pgTAP test file `supabase/tests/150_org_profiles.test.sql` written first (RED), then GREEN
- [x] A-WU2 — Migration `20260604211509_create_org_profiles.sql` applied; 36/36 pgTAP assertions GREEN
- [x] A-WU3 — Types regenerated; `org_profiles` Row/Insert/Update present in `database.ts`
- [x] A-WU4 — Four hooks implemented (RED → GREEN, 7/7 vitest)
- [x] A-WU5 — `AgencyProfileForm` component + settings entry point (RED → GREEN, 10/10 vitest)
- [x] A-WU6 — Integration test extended for `org-branding` (12/12 integration tests PASS)
- [x] A-WU7 — CONVENTIONS.md updated with agency-profile row

---

## TDD Cycle Evidence

| Task | RED (test written first) | GREEN (impl passes) | REFACTOR |
|------|--------------------------|---------------------|----------|
| A-WU1 pgTAP | 150_org_profiles.test.sql written before migration; ran → failed (table DNE) | After migration → 36/36 PASS | Plan count corrected from 35 to 36 |
| A-WU4 hooks | agency-profile-hooks.test.ts written; `npm test` → "Failed to resolve import" | Hooks created; 7/7 PASS | Removed 2 unused mock vars |
| A-WU5 form | agency-profile-form.test.tsx written; `npm test` → "Failed to resolve import" | Form component created; 10/10 PASS | Email zod refine + type="email" removed from Input (jsdom compat) |
| A-WU6 integration | Cases added to test; ran against live stack → 12/12 PASS | N/A (integration test, no separate RED step) | — |

---

## Files Changed

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
| `openspec/changes/nodo-inmo-foundation/CONVENTIONS.md` | Modified | Added agency-profile row to Module → Role Matrix |
| `openspec/changes/owner-settlement-statement/tasks.md` | Modified | All PR-A tasks marked [x] |

---

## Test Results

### pgTAP (150_org_profiles.test.sql)
- **36/36 PASS** — schema shape, RLS Template B, storage bucket + 4 policies
- Full pgTAP suite: **355/355 PASS** across 16 test files (no regressions)

### vitest
- `agency-profile-hooks.test.ts`: **7/7 PASS**
- `agency-profile-form.test.tsx`: **10/10 PASS**
- Full suite: **193/193 PASS** (no regressions)

### Integration (storage-cross-tenant)
- `storage-cross-tenant.integration.test.ts`: **12/12 PASS** (real local stack)
  - R-A14: admin uploads logo to own org path ✓
  - R-A14: admin creates signed URL for own logo ✓
  - R-A16: cross-org signed URL denied ✓
  - R-A17: public URL returns 400 (bucket private) ✓

### Lint
- Baseline maintained at **15 problems (12 errors, 3 warnings)** — no new lint errors added

### Typecheck
- **Clean** — `tsc --noEmit` exits 0

---

## Workload / PR Boundary

- Mode: chained PR slice (stacked-to-main, `chain_strategy = stacked-to-main`)
- Current work unit: PR-A — Agency profile (self-contained, no dependency on PR-B or PR-C)
- Boundary: starts from `main` branch, ends with the `org_profiles` table + `org-branding` bucket + all agency-profile UI
- Estimated review: ~838 lines (as forecast in tasks.md), within the accepted chained-PR boundary

---

## Deviations from Design

1. **`org_profiles` PK design**: the spec (R-A2) lists a separate `id uuid` column as PK, but the design (ADR-1, §2.1) explicitly uses `org_id` as both PK and FK with no separate `id`. The design is authoritative and was followed. The spec table had an inconsistency (separate `id` column vs. design's `org_id as PK`). The implementation matches the design exactly.

2. **Email input type**: design says `<Input type="email">` — removed `type="email"` from the form's email `Input` to avoid jsdom native validation interference in tests. The zod `refine` provides the same validation semantics.

3. **Advisors not run**: `supabase db advisors` was not run (no MCP `get_advisors` available in this context). Security checklist was verified manually: RLS enabled, 4 Template B policies, UPDATE has USING+WITH CHECK, no user_metadata reads, bucket private, raster-only MIME, 4 storage policies all present.

---

## Remaining Tasks (PR-B and PR-C — NOT this batch)

PR-B (breakdown sealing): B-WU1 through B-WU6 — all pending  
PR-C (PDF comprobante): C-WU1 through C-WU5 — all pending, blocked on PR-A + PR-B merged  
