# Apply Progress — documentos-module Phase D

**Change**: documentos-module Phase D  
**Mode**: Strict TDD  
**Completed**: 2026-06-06  

## TDD Cycle Evidence

| Task | RED (test written first) | GREEN (implementation passes) | REFACTOR |
|------|--------------------------|-------------------------------|----------|
| T-D1 | `180_documents.test.sql` (pgTAP) | Migration applied, 35/35 pass | No |
| T-D2 | N/A (mechanical env sync) | `database.ts` regenerated, `documents` table present | N/A |
| T-D3 | `use-documents.test.tsx` (7 tests) | Hook implemented, all pass | Moved `.eq()` before `.order()` for testability |
| T-D4 | `use-upload-document.test.tsx` (8 tests) | Hook implemented, all pass | No |
| T-D5 | `use-delete-document.test.tsx` (5 tests) | Hook implemented, all pass | No |
| T-D6 | `upload-document-dialog.test.tsx` (9 tests) | Dialog implemented, all pass | Mocked Radix Select with native `<select>` per project pattern |
| T-D7 | `document-type-badge.test.tsx` (9), `documents-table.test.tsx` (6), `documents-section.test.tsx` (4) | All components implemented, all pass | Stubbed DocumentsSection in documentos-page.test |
| T-D8 | Manual wiring checklist (no new tests) | Build passes, pgTAP passes | N/A |

## Completed Tasks

- [x] T-D1 — DB migration: `nodo_inmo.documents` table + Storage bucket `org-documents` + RLS (Template B) + pgTAP test
- [x] T-D2 — Apply migration locally + regenerate `src/shared/types/database.ts`
- [x] T-D3 — `useDocuments` hook + 7 tests (all pass)
- [x] T-D4 — `useUploadDocument` composite mutation + 8 tests (all pass) + `sanitizeFilename`
- [x] T-D5 — `useDeleteDocument` mutation + 5 tests (all pass)
- [x] T-D6 — `UploadDocumentDialog` component + 9 tests (all pass)
- [x] T-D7 — `DocumentTypeBadge` + `DocumentsTable` + `DocumentsSection` + wired into `documentos-page.tsx` + 19 component tests (all pass)
- [x] T-D8 — pgTAP test passes (35/35), build passes, full test suite 338/338 green

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260606130000_create_documents.sql` | Created | Table + indexes + trigger + RLS (Template B) + Storage bucket + 4 storage policies |
| `supabase/tests/180_documents.test.sql` | Created | 35 pgTAP tests: table shape, NOT NULL, nullable, check constraint, RLS, storage bucket + policies |
| `src/shared/types/database.ts` | Regenerated | Added `nodo_inmo.documents` table types |
| `src/features/documentos/hooks/use-documents.ts` | Created | `useDocuments` query hook with optional filter |
| `src/features/documentos/hooks/use-upload-document.ts` | Created | Composite upload+insert mutation + `sanitizeFilename` |
| `src/features/documentos/hooks/use-delete-document.ts` | Created | Delete storage + DB row mutation |
| `src/features/documentos/hooks/use-document-url.ts` | Created | `getDocumentSignedUrl` (60s TTL, private bucket) |
| `src/features/documentos/hooks/index.ts` | Created | Barrel exports |
| `src/features/documentos/components/document-type-badge.tsx` | Created | Color-coded badge (factura=blue, presupuesto=yellow, certificado=green, otro=gray) |
| `src/features/documentos/components/documents-table.tsx` | Created | Table with download (signed URL) and delete (AlertDialog) actions |
| `src/features/documentos/components/documents-section.tsx` | Created | Section glue: header + table + upload dialog |
| `src/features/documentos/components/upload-document-dialog.tsx` | Created | Full form: label, type, property, contract, notes, file (max 10MB client validation) |
| `src/features/documentos/components/documentos-page.tsx` | Modified | Added `<DocumentsSection />` below contracts table with visual separator |
| `src/features/documentos/__tests__/use-documents.test.tsx` | Created | 7 tests |
| `src/features/documentos/__tests__/use-upload-document.test.tsx` | Created | 8 tests |
| `src/features/documentos/__tests__/use-delete-document.test.tsx` | Created | 5 tests |
| `src/features/documentos/__tests__/upload-document-dialog.test.tsx` | Created | 9 tests |
| `src/features/documentos/__tests__/document-type-badge.test.tsx` | Created | 9 tests |
| `src/features/documentos/__tests__/documents-table.test.tsx` | Created | 6 tests |
| `src/features/documentos/__tests__/documents-section.test.tsx` | Created | 4 tests |
| `src/features/documentos/__tests__/documentos-page.test.tsx` | Modified | Added DocumentsSection stub |

## Deviations from Design

1. **`useDocuments` query order**: Design showed `.order()` after `.eq()`, but the hook was written with `.order()` before `.eq()` initially. Refactored during RED→GREEN to call `.eq()` before `.order()` for testability (same Supabase result, mock chain simpler).

2. **`UploadDocumentDialog` props**: Design spec used `{ open, onOpenChange }` props (not trigger slot). Implemented as-is from design — avoids extra Radix DialogTrigger complexity. Matches `ExpenseFormDialog` pattern.

3. **`useDocumentUrl` as function, not hook**: Implemented `getDocumentSignedUrl` as an async function rather than a `useQuery` hook. This avoids needing to render the hook per-row and having 60s staleTime issues; the function is called on demand in `handleDownload`. Matches `ADR-D7` spirit (fresh URL at read time, never cached).

## Issues Found

Pre-existing unused `MessageSquare` import in `src/features/feedback/components/feedback-node.tsx` (unrelated to documentos-module) caused a `tsc` error during the final build check. Removed the unused import — tests unaffected, build now clean.

## Remaining Tasks

None for Phase D. All T-D1 through T-D8 complete.

## Status

8/8 tasks complete. Ready for `sdd-verify`.
