# Tasks: nodo-inmo-foundation (TDD)

Strict TDD. Every implementation slice follows **RED → GREEN → REFACTOR**:
1. **RED**: write the pgTAP test for the requirement, run `supabase test db`, watch it fail.
2. **GREEN**: write the minimum migration SQL to make it pass.
3. **REFACTOR**: clean up; tests stay green.

Test tool: **pgTAP** via `supabase test db`. TDD loop runs against a **local** Supabase
(`supabase start`); the migration is pushed to the shared remote only once all tests are
green. Tests live in `supabase/tests/` and are the contract for spec.md (R1–R18).

Legend: 🔴 write failing test first · 🟢 implement to green · 👤 manual user action · ⬆️ push to remote.

## 0. Test harness setup (no app code yet)

- [ ] Run `supabase init` in nodo-inmo (creates `supabase/`, `config.toml`).
- [ ] `supabase start` — local Postgres + Studio for the TDD loop.
- [ ] Enable pgTAP for tests (extension in the test schema) and create
      `supabase/tests/` with a first trivial pgTAP test (`SELECT plan(1); SELECT ok(true); SELECT * FROM finish();`).
- [ ] Confirm `supabase test db` runs and the trivial test passes (harness works).
- [ ] Add a tiny test helper to set an authenticated context:
      `set local role authenticated` + `set local request.jwt.claims = '{"sub":...,"app_metadata":{"org_id":...,"role":...}}'`.

## 1. Schemas (R1)

- [ ] 🔴 pgTAP: assert schemas `shared` and `nodo_inmo` exist (`has_schema`); assert
      `public` still has a known nodo-core table.
- [ ] 🟢 Migration: `create schema shared; create schema nodo_inmo;`.

## 2. Tenant tables: structure (R3, R4)

- [ ] 🔴 pgTAP: `shared.organizations` — has table, PK on `id`, `tier` check rejects
      values outside (starter, pro).
- [ ] 🟢 Migration: create `shared.organizations`.
- [ ] 🔴 pgTAP: `shared.org_members` — PK (org_id, user_id), `role` check rejects
      values outside (admin, agent, owner, tenant), FK to organizations.
- [ ] 🟢 Migration: create `shared.org_members` + user index.
- [ ] 🔴 pgTAP: `shared.user_profiles`, `shared.indices` (unique kind+period),
      `shared.nodo_id` (unique org+product) structure asserts.
- [ ] 🟢 Migration: create those three tables.

## 3. RLS enabled (R6)

- [ ] 🔴 pgTAP: assert `relrowsecurity = true` for every table in `shared` and `nodo_inmo`.
- [ ] 🟢 Migration: `enable row level security` on each table.

## 4. Tenant isolation policies (R7, R8, R9, R10, R11, R12)

- [ ] 🔴 pgTAP (R7): seed orgs A and B; as a member of A, select from an org-scoped
      table returns only A rows, 0 from B.
- [ ] 🟢 Migration: org-scoped SELECT policies (organizations, org_members, nodo_id).
- [ ] 🔴 pgTAP (R10): as `agent`, insert into org_members is rejected; as `admin`,
      it succeeds.
- [ ] 🟢 Migration: admin-only membership write policy (JWT role, no self-join).
- [ ] 🔴 pgTAP (R11): user can read/write only their own user_profiles row.
- [ ] 🟢 Migration: self-scoped profile policy.
- [ ] 🔴 pgTAP (R12): authenticated can SELECT indices but INSERT is rejected.
- [ ] 🟢 Migration: indices read-all policy (no write policy for authenticated).
- [ ] 🔴 pgTAP (R8): set conflicting `user_metadata` org_id; effective access still
      follows `app_metadata`.
- [ ] 🔴 pgTAP (R9): updating a row's `org_id` to org B is rejected by WITH CHECK.
- [ ] 🟢 Migration: ensure UPDATE policies carry USING + WITH CHECK.

## 5. RLS templates A/B + role gate (R15, R17, R18)

- [x] 🔴 pgTAP (R17): on a Template B (admin-only) test table, `agent` gets 0 rows,
      `admin` gets the org rows. On a Template A table, both staff roles read org rows.
- [x] 🟢 Migration/docs: codify Template A and Template B as the reusable convention
      (design §5, §5b) and prove with the test fixture; drop the fixture after.
- [x] Document module→role matrix (design §5b) and the R18 note (UI mirrors, not replaces).

## 6. JWT app_metadata sync (R13, R14)

- [x] Create Edge Function `sync-member-claims` (verifies trigger secret; calls
      `auth.admin.updateUserById`; idempotent; logs failures).
- [x] 🔴 pgTAP: assert trigger `sync_member_claims` exists on `org_members` for
      insert/update of (role, org_id), and the function is `security definer` with
      `search_path = ''`. (Behavioral claim propagation is integration-tested against
      local Supabase auth, not pure pgTAP.)
- [x] 🟢 Migration: create `shared.sync_member_claims()` + trigger.
- [x] Integration test (local): change a member role → after `refreshSession()`,
      JWT `app_metadata.role` reflects it (R13).
- [x] Document the `refreshSession()` convention (R14).

## 7. Verification gate (R16)

- [x] 🧪 `supabase db advisors` / MCP `get_advisors` clean (no security errors).
- [x] Walk design §7 security checklist.
- [x] Confirm `supabase test db` is fully green.

## 8. Ship to the shared remote

- [ ] 👤 Dashboard (remote) → Settings → API → Exposed schemas: add `shared` and
      `nodo_inmo` (MCP cannot toggle this).
- [ ] ⬆️ `supabase db push` to apply the migration to the shared project.
- [ ] ⬆️ Deploy the `sync-member-claims` Edge Function; set its secret/URL.
- [ ] 🧪 Re-run the cross-tenant + admin-only assertions against the remote (via MCP
      `execute_sql`) to confirm parity with local.
- [ ] Commit migration + tests + Edge Function (work-unit-commits).

---

## Review Workload Forecast

- Estimated changed lines: ~400–500 (SQL DDL + policies + pgTAP tests + Edge Function).
  Tests roughly double the line count vs the non-TDD draft.
- 400-line budget risk: **Medium** (tests push it up).
- Chained PRs recommended: **Optional** — could split as PR1 (harness + schemas +
  tenant tables + isolation tests) and PR2 (templates + JWT sync + ship). Re-assess at apply.
- Local-first: sections 0–7 need no remote and no 👤 step; only section 8 touches the
  shared remote and needs your dashboard action + a connected environment.
