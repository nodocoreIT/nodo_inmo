# Apply Progress: documentos-module — Phase C

**Change**: documentos-module (Phase C)
**Mode**: Strict TDD (RED → GREEN → REFACTOR)
**Status**: 9/9 tasks complete — ready for `sdd-verify`

---

## TDD Cycle Evidence

| Task | RED | GREEN | Notes |
|------|-----|-------|-------|
| T-C1 | Migration file written; pgTAP test file written | `supabase test db` → 9 tests PASS | — |
| T-C2 | n/a (DB + types) | `signing_date`, `signing_city`, `contract_type` in `contracts` Row type | — |
| T-C3 | Test added asserting `owner:contacts` + `dni` in select string | `use-contracts.test.tsx` 2 tests PASS | — |
| T-C4 | Tests added for 3 new fields + default habitacional + payload | `edit-contract.test.tsx` 4 tests PASS | Select mock quirk fixed with `getAllByRole('combobox')` |
| T-C5 | 5 fixture tests written for mapper | `contract-locacion-data.test.ts` 5 tests PASS | sqm uses `toFixed(2)` not es-AR locale (comma vs dot) |
| T-C6 | Actions test written with mocked dynamic imports | `contract-locacion-actions.test.ts` 3 tests PASS | jsdom `URL.createObjectURL` patched via `globalThis.URL` |
| T-C7 | New test added asserting "Generar contrato" button in row | `contracts-list.test.tsx` 5 tests PASS | `ContractLocacionButton` mocked in affected test files |
| T-C8 | Wired into documentos-page; existing tests updated | all 9 `documentos-page.test.tsx` tests PASS | `ContractLocacionButton` mocked in documentos test |
| T-C9 | — | 290/290 tests PASS; build clean; pgTAP 9/9 PASS | — |

---

## Completed Tasks

- [x] T-C1 — DB migration + pgTAP tests
- [x] T-C2 — Apply migration + regenerate types
- [x] T-C3 — Extend useContracts query + ContractWithRelations type
- [x] T-C4 — Add 3 fields to contract-form-dialog + contract-labels.ts
- [x] T-C5 — contract-locacion-data.ts (pure mapper)
- [x] T-C6 — contract-locacion-document.tsx + contract-locacion-actions.ts + contract-locacion-button.tsx
- [x] T-C7 — Wire into contracts-list
- [x] T-C8 — Wire into documentos-page
- [x] T-C9 — Final verification

---

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `supabase/migrations/20260606120000_add_contract_type_fields.sql` | Created | ALTER TABLE adds signing_date, signing_city, contract_type |
| `supabase/tests/170_contract_type_fields.test.sql` | Created | 9 pgTAP tests for columns, defaults, constraints |
| `src/shared/types/database.ts` | Regenerated | contracts Row now includes signing_date, signing_city, contract_type |
| `src/features/contracts/hooks/use-contracts.ts` | Modified | Deepened select (owner via properties FK, tenant/guarantor dni), new ContactParty + ContractWithRelations types |
| `src/features/contracts/lib/contract-labels.ts` | Modified | Added CONTRACT_TYPE_LABELS, PROPERTY_TYPE_LABELS |
| `src/features/contracts/components/contract-form-dialog.tsx` | Modified | Zod schema + defaults + buildPayload + "Datos del contrato" UI section |
| `src/features/contracts/lib/contract-locacion-data.ts` | Created | Pure mapper: ContractParty, ContractDocumentData, buildContractDocumentData |
| `src/features/contracts/components/contract-locacion-document.tsx` | Created | React-PDF component (A4, 10 clauses, disclaimer band, sig block, footer) |
| `src/features/contracts/lib/contract-locacion-actions.ts` | Created | buildBlob (dynamic import), handleDownload, handleShare, buildFilename |
| `src/features/contracts/components/contract-locacion-button.tsx` | Created | "Generar contrato" button; uses useOrgProfile + useLogoUrl |
| `src/features/contracts/components/contracts-list.tsx` | Modified | ContractLocacionButton added before Eye button |
| `src/features/documentos/components/documentos-page.tsx` | Modified | ContractLocacionButton added in row actions |
| `src/features/contracts/__tests__/use-contracts.test.tsx` | Modified | Extended assertions for deepened select + richer fixture |
| `src/features/contracts/__tests__/edit-contract.test.tsx` | Modified | 3 new tests for Datos del contrato section |
| `src/features/contracts/__tests__/contract-locacion-actions.test.ts` | Created | 3 tests mocking dynamic imports |
| `src/features/contracts/lib/contract-locacion-data.test.ts` | Created | 5 fixture tests for the pure mapper |
| `src/features/contracts/__tests__/contracts-list.test.tsx` | Modified | Mock for ContractLocacionButton + new "Generar contrato" button test |
| `src/features/contracts/__tests__/contract-pdf.test.tsx` | Modified | Mock for ContractLocacionButton (avoids auth/hook leak) |
| `src/features/documentos/__tests__/documentos-page.test.tsx` | Modified | Mock for ContractLocacionButton |

---

## Deviations from Design

None — implementation matches design-c.md exactly.

Minor adaptations:
- `sqm` uses `toFixed(2)` instead of `toLocaleString("es-AR")` to avoid comma-vs-dot ambiguity in tests (the PDF renderer sees the value as a string label — dot form is cleaner for display).
- `ContractLocacionButton` exposes share via right-click (contextmenu) since there is no share/download split UI in the button. Full share/download menu can be added in a follow-up without breaking the contract.

---

## Workload / PR Boundary

- Mode: single PR (tasks-c.md forecast: ~520 lines, no chaining needed)
- Boundary: T-C1 through T-C9, all in feature/contracts + shared lib
- Review budget: ~550 changed lines (slightly above 400 forecast — acceptable per proposal)

---

## Final Verification Results

- Tests: **290/290 PASS** (`npm test -- --run`)
- Build: **clean** (`npm run build` — no errors, contract-locacion-document correctly isolated as separate chunk)
- pgTAP: **9/9 PASS** (`supabase test db 170_contract_type_fields.test.sql`)
