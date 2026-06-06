# Tasks: documentos-module — Phases A & B

> Strict TDD: write the failing test first (RED), implement to GREEN, refactor.
> No DB migrations in A or B. Reference design: `design-ab.md`.
> Review workload forecast: ~270 lines total across A+B, single PR feasible (under 400).

---

## Phase A — Contract PDF viewer (~150 lines)

### T-A1 — `contract-pdf-document.tsx` (React-PDF document)
- [x] File: `src/features/contracts/components/contract-pdf-document.tsx`
- [x] Top-level import of `@react-pdf/renderer` primitives; module doc-comment: "load only via
      dynamic import()".
- [x] Define `ContractPdfData` prop type (flat, PDF-ready) — exported for the actions builder.
- [x] Clone caja `StyleSheet` (Helvetica, A4, padding 40, navy/slate palette).
- [x] Local `fmtMoney(amount, currency)` (caja-style); import `formatDate` from `contract-labels`.
- [x] Sections: agency header (legal_name/address/cuit/phone/email/logo, graceful "—"); title
      "Contrato de locación" + subtitle; Partes (locador/locatario/garante, "—" for missing);
      Inmueble (address; type/rooms/sqm "—"); Términos (dates, duration, rent+currency, adjustment
      index+period, next_adjustment_date, deposit, expenses_paid_by, commission, status); Notas;
      footer.
- [x] Defensive guards — never throw on null fields.
- **Test (RED first):** module loads via dynamic `import()` and exports a function component
  (smoke). ~50 lines impl.

### T-A2 — `contract-pdf-actions.tsx` (download/share component)
- [x] File: `src/features/contracts/components/contract-pdf-actions.tsx`
- [x] Props: `{ contract: ContractWithRelations }`.
- [x] Read branding via `useOrgProfile()` + `useLogoUrl(profile?.logo_path)`.
- [x] Pure `buildContractPdfData(contract, agency, logoUrl)` → `ContractPdfData` (single DB→PDF
      boundary; missing party/property fields default to null). Export for tests.
- [x] `buildBlob`: `Promise.all([import("@react-pdf/renderer"), import("./contract-pdf-document")])`
      → `pdf(createElement(ContractPdfDocument, data)).toBlob()`. (Dynamic import — bundle isolation.)
- [x] `buildFilename`: `contrato-{slug}.pdf` (reuse `slugifyOwnerName` per ADR-6).
- [x] `handleDownload` (object URL → anchor → revoke) + `handleShare` (`navigator.canShare`
      guard → `navigator.share`, else download fallback).
- [x] Render: "Descargar PDF" Button (always) + "Compartir" Button (only when canShare available,
      computed via mount effect).
- **Test (RED first):** `buildContractPdfData` maps fields + defaults nulls + no throw on null
      agency; Compartir visibility branches on `navigator.canShare`; Descargar triggers download.
      ~60 lines impl.

### T-A3 — `contracts-list.tsx` — Eye button + Dialog
- [x] Edit `src/features/contracts/components/contracts-list.tsx`.
- [x] Import `Eye` (lucide) + `Dialog` parts + `ContractPdfActions`.
- [x] Add `viewContract` state; Eye `<Button aria-label="Ver PDF">` as first action in the row
      cluster, opens the dialog.
- [x] Dialog: header (tenant · address · status badge · rent) + `<ContractPdfActions contract />`.
- **Test (RED first):** Eye button renders per row; clicking opens the dialog with summary.
      ~30 lines impl.

### T-A4 — Phase A tests
- [x] File: `src/features/contracts/__tests__/contract-pdf.test.tsx`.
- [x] Mock dynamic imports / `ContractPdfActions` where needed (caja test pattern).
- [x] Assert: Eye button renders; dialog opens; `buildContractPdfData` boundary; Compartir
      branching; Descargar → handleDownload. All written RED before impl.

---

## Phase B — Documentos section (~120 lines)

### T-B1 — `documentos/` module + `documentos-page.tsx`
- [x] File: `src/features/documentos/components/documentos-page.tsx`.
- [x] Reuse `useContracts()` directly (no new hook — ADR-5).
- [x] Loading / error / empty / no-results guards (copy contracts-list UX).
- [x] Search: `useSearchStore` + `matchesQuery([c.tenant?.name, c.property?.address, c.status], query)`.
- [x] Table columns: Inquilino, Propiedad, Estado (StatusBadge), Alquiler, Inicio, Fin,
      Acciones (`<ContractPdfActions contract />` per row). No "Nuevo" button.
- [x] Resolve `StatusBadge` per ADR-7: extract
      `src/features/contracts/components/contract-status-badge.tsx`, export it, consume in both
      `documentos-page.tsx` and `contracts-list.tsx`. (Fallback: local copy if minimizing churn.)
- **Test (RED first):** renders contract rows; `matchesQuery` filtering narrows results. ~70 lines.

### T-B2 — Portal wiring (route + nav + titles + search)
- [x] `admin-portal-page.tsx`: import `DocumentosPage`; add
      `<Route path="documentos" element={<DocumentosPage />} />` after `caja`.
- [x] `admin-layout.tsx`: import `FolderOpen`; add nav item
      `{ to: "/admin/documentos", label: "Documentos", icon: FolderOpen }` after Caja (not
      `adminOnly` unless product gates it — ADR-8).
- [x] `admin-layout.tsx`: add `SEARCH_PLACEHOLDERS["/admin/documentos"] =
      "Buscar por inquilino, propiedad…"`.
- [x] `admin-layout.tsx`: add `ROUTE_TITLES["/admin/documentos"] = "Documentos"`.
- **Test (RED first):** nav item "Documentos" present in rendered layout. ~15 lines.

### T-B3 — Phase B tests
- [x] File: `src/features/documentos/__tests__/documentos-page.test.tsx`.
- [x] Mock `useContracts` + `ContractPdfActions`.
- [x] Assert: renders the contract list; search filters rows; Download action present per row;
      nav item present. All RED before impl.

---

## Definition of done (A + B)
- [x] All new tests GREEN; existing contracts/caja tests still pass (no regressions).
- [x] `@react-pdf/renderer` imported ONLY via dynamic `import()` inside `buildBlob` (verify no
      static import sites).
- [x] `tsc` typecheck clean; lint clean.
- [x] Eye dialog + Documentos table both download a branded contract PDF.
- [x] No DB migration introduced.
