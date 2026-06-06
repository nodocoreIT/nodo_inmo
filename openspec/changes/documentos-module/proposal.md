# Proposal: documentos-module

## Intent

Build a comprehensive document management hub for the agency — 4 sequential phases, each independently shippable.

## Phases

### Phase A — Contract PDF viewer (Eye icon)
Eye icon on every contract row opens a Dialog with the contract summary and a "Descargar PDF" button. Reuses the same dynamic-import + `pdf().toBlob()` pattern from the settlement comprobante. NO new DB columns, NO new route.

### Phase B — Documentos section (/admin/documentos)
New top-level route and sidebar item. Page contains a contract browser (search by tenant, property, status) with the same `useSearchStore + matchesQuery` pattern. Architectural home for Phase D expansion.

### Phase C — Argentine contract generator
Full "Contrato de Locación" PDF template (Ley 27.551, 2026). Habitacional and comercial variants. Template renders: parties (locador, locatario, garante), property, financial terms, legal clauses, signature lines, agency header with logo.

DB migration: add `signing_date` (date, nullable), `signing_city` (text, nullable, default CABA), `contract_type` (text, check habitacional|comercial, default habitacional) to `nodo_inmo.contracts`.

Form dialog: new "Datos del contrato" section with those 3 fields.

`useContracts` query extended to embed owner data via properties FK.

Legal disclaimer on every generated PDF.

### Phase D — Document storage
New `nodo_inmo.documents` table: id, org_id, property_id?, contract_id?, label, document_type (factura|presupuesto|certificado|otro), file_path, notes, uploaded_at.

New private `org-documents` Storage bucket (Template B RLS, same pattern as property-expense-receipts).

Upload UI in `/admin/documentos`. Documents list per property/contract. Associate to either a property or a contract.

## Key decisions (locked)

| Decision | Choice |
|----------|--------|
| PDF preview | Download-only (no iframe/PDFViewer) — consistent with caja pattern, works on all browsers |
| New fields location | In the existing contract form dialog (Option A) — save to DB, regenerate any time |
| Contract template | Static React-PDF component with conditional clauses by contract_type |
| Boilerplate clauses | Hardcoded in the PDF component (not DB-stored) |
| contract_type values | habitacional / comercial |
| documents table | Separate from property_expenses (different concern: general docs vs financial deductions) |
| Storage bucket | New `org-documents` bucket |
| Phase order | A → B → C → D (A and B can ship in parallel) |

## DB changes summary

| Phase | Migration |
|-------|-----------|
| A | None |
| B | None |
| C | ALTER TABLE contracts ADD COLUMN signing_date, signing_city, contract_type |
| D | CREATE TABLE documents + storage policies |

## Argentine contract clauses (Phase C, static text)

Standard habitacional (Ley 27.551):
1. Objeto del contrato
2. Plazo (mínimo 3 años para habitacional, 2 para comercial)
3. Canon locativo + ajuste
4. Depósito en garantía (máx 1 mes para habitacional)
5. Servicios y expensas
6. Uso exclusivo del inmueble
7. Prohibición de cesión y subarrendamiento
8. Estado de conservación y devolución
9. Rescisión anticipada (art. 13 Ley 27.551)
10. Fuero competente
11. Disclaimer legal

## Risks

- Owner data join in useContracts requires deeply nested PostgREST query — test carefully
- contacts.dni is free text (no DNI/CUIL format validation) — print as-is
- @react-pdf/renderer v4.x: follow existing StyleSheet patterns from SettlementStatementDocument
- Phase D Storage RLS: all 4 policies (SELECT/INSERT/UPDATE/DELETE) must be in migration
