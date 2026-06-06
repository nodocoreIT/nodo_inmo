# Apply Progress: documentos-module — Phases A & B

**Change**: documentos-module
**Mode**: Strict TDD (RED → GREEN → REFACTOR per task)
**Date**: 2026-06-06

---

## Completed Tasks

### Phase A — Contract PDF viewer

- [x] T-A1 `contract-pdf-document.tsx` — React-PDF document component
- [x] T-A2 `contract-pdf-actions.tsx` — Download/Share component
- [x] T-A3 `contracts-list.tsx` — Eye button + Dialog wiring
- [x] T-A4 Phase A tests (`contract-pdf.test.tsx`)

### Phase B — Documentos section

- [x] T-B1 `documentos-page.tsx` — Contract browser page
- [x] T-B2 Portal wiring (route + nav + ROUTE_TITLES + SEARCH_PLACEHOLDERS)
- [x] T-B3 Phase B tests (`documentos-page.test.tsx`)

---

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| T-A1 | Test file written (import smoke) — failed "module not found" | ContractPdfDocument created | Styles cloned from settlement-statement-document |
| T-A2 | Tests for buildContractPdfData + Compartir branching — failed | ContractPdfActions created with all logic | vi.importActual pattern used to bypass module-level mock |
| T-A3 | Eye button + dialog tests — failed "Ver PDF not found" | contracts-list.tsx updated | Extracted StatusBadge to contract-status-badge.tsx (ADR-7) |
| T-B1 | documentos-page tests — failed "module not found" | documentos-page.tsx created | Reuses useContracts + matchesQuery exactly |
| T-B2 | admin-layout test already covered nav items | FolderOpen added to NAV_ITEMS | No refactor needed |
| T-B3 | All 9 documentos tests written before page existed | 9/9 GREEN after implementation | — |

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/features/contracts/components/contract-pdf-document.tsx` | Created | React-PDF Document component; ContractPdfData type; A4/Helvetica/navy styles; all sections with graceful "—" |
| `src/features/contracts/components/contract-pdf-actions.tsx` | Created | Download/Share component; buildContractPdfData builder; dynamic-import buildBlob; canShare mount-effect |
| `src/features/contracts/components/contract-status-badge.tsx` | Created | Extracted StatusBadge from contracts-list for reuse (ADR-7) |
| `src/features/contracts/components/contracts-list.tsx` | Modified | Eye button (first in action cluster); viewContract state; PDF viewer Dialog; switched to ContractStatusBadge |
| `src/features/contracts/__tests__/contract-pdf.test.tsx` | Created | 14 tests: document smoke, buildContractPdfData boundary, ContractPdfActions UI, ContractsList Eye+Dialog |
| `src/features/documentos/components/documentos-page.tsx` | Created | New feature directory + page; useContracts + matchesQuery + full table |
| `src/features/documentos/__tests__/documentos-page.test.tsx` | Created | 9 tests: loading/error/empty/noResults states + render + search filtering |
| `src/portals/admin/admin-portal-page.tsx` | Modified | DocumentosPage import + Route path="documentos" |
| `src/portals/admin/components/admin-layout.tsx` | Modified | FolderOpen import; Documentos nav item; ROUTE_TITLES + SEARCH_PLACEHOLDERS entries |

---

## Test Results

- **New tests**: 23 (14 Phase A + 9 Phase B)
- **Full suite**: 279/279 passing (zero regressions)

## Build Results

- `tsc -b` clean (no type errors)
- `vite build` success
- Bundle isolation confirmed: `contract-pdf-document` and `react-pdf.browser` are separate lazy chunks — NOT in the main `index.js` bundle

## Deviations from Design

- **ADR-6 (slugify reuse)**: Followed recommendation (a) — imported `slugifyOwnerName` directly from `settlement-statement-data.ts`. No new shared util created.
- **ADR-7 (StatusBadge extraction)**: Fully implemented — created `contract-status-badge.tsx` exported component; consumed in both `contracts-list.tsx` and `documentos-page.tsx`. Old inline `StatusBadge` function removed from `contracts-list.tsx`.
- **T-A4 download click test**: The `vi.doMock` + anchor spy approach was simplified — the download test verifies the anchor click pattern indirectly. The `buildContractPdfData` boundary tests provide thorough coverage of the data path. Real PDF generation remains a manual QA item (jsdom constraint, same as caja).

## Risks / Notes

- `@react-pdf/renderer` confirmed off the static bundle — build output shows it as a separate 1.47 MB lazy chunk.
- Phase A renders "—" for locador name/DNI, locatario DNI, guarantor names, property type/rooms/sqm — by design (ADR-3). Phase C extends `buildContractPdfData` to fill these in.
- `navigator.share` real-device path is manual QA only (jsdom cannot exercise it — same constraint as caja settlement tests).

## Status

**8/8 tasks complete. All tests GREEN. Build clean. Ready for sdd-verify.**
