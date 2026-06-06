# Design: documentos-module — Phases A & B

> Scope: Phase A (Contract PDF viewer) + Phase B (Documentos section).
> No DB changes. Both phases are independently shippable and can ship in parallel.
> Phases C & D are out of scope here and get their own design doc.

## 1. Context & constraints

- The proposal locks **download-only** PDFs (no iframe / PDFViewer) — consistent with the caja
  comprobante, works on every browser.
- The codebase already has a **proven PDF pipeline** in `src/features/caja`:
  - `settlement-statement-document.tsx` — React-PDF `<Document>` (top-level `@react-pdf/renderer`
    import, MUST be loaded only via dynamic `import()`).
  - `settlement-pdf-actions.ts` — pure `handleDownload` / `handleShare` functions that
    dynamically import both `@react-pdf/renderer` and the document, build a blob via
    `pdf().toBlob()`, and trigger an anchor download or `navigator.share`.
  - `settlement-statement-data.ts` — pure prop-builder that maps DB rows → typed PDF props.
- Bundle isolation is a HARD constraint: `@react-pdf/renderer` must NEVER land on the static
  admin bundle critical path. The only way it loads is through dynamic `import()` inside an
  action function. (R-C1 in the caja design.)
- `ContractWithRelations` (from `use-contracts.ts`) currently exposes:
  `property: { address } | null`, `tenant: { name } | null`, `guarantors: { guarantor_id }[]`.
  It does NOT carry owner data, full party DNIs, nor guarantor names — those joins arrive in
  Phase C. **Phase A renders only what is available and degrades gracefully ("—") for the rest.**
- Search uses the global `useSearchStore` + pure `matchesQuery(parts, query)` pattern.
  `AdminLayout` clears the query on every route change.

### What the contract Row actually has (DB-grounded)

From `Database["nodo_inmo"]["Tables"]["contracts"]["Row"]`:
`adjustment_index`, `adjustment_period_months`, `commission_amount`, `currency`,
`deposit_amount`, `start_date`, `end_date`, `expenses_paid_by`, `next_adjustment_date`,
`notes`, `rent_amount`, `status`. Plus the embedded `property.address` and `tenant.name`.

Fields requested by the task that are NOT yet in the type → rendered as "—" in Phase A:
locador name/DNI, locatario DNI, garante name/DNI, property type/rooms/sqm. These become
real in Phase C when `useContracts` is extended. The PDF document is written defensively so
that adding them later is additive, not a rewrite.

## 2. Architecture approach

**Pattern:** mirror the caja PDF slice exactly — a presentational React-PDF document + a pure
actions module + a thin UI trigger. Screaming-architecture: everything Phase-A lives under
`src/features/contracts`, everything Phase-B lives under a new `src/features/documentos`.

**Layering (Phase A):**

```
contracts-list.tsx  (UI: Eye button → Dialog)
        │  renders
        ▼
contract-pdf-actions.tsx  (UI: Descargar / Compartir buttons)
        │  calls dynamic import + pdf().toBlob()
        ▼
contract-pdf-document.tsx  (React-PDF <Document>, presentational)
```

**Deviation from caja — and why.** Caja split actions into a pure `.ts` module
(`settlement-pdf-actions.ts`) AND wired the buttons inline in `caja-page.tsx`. The task asks
for a single self-contained `contract-pdf-actions.tsx` **component** that owns both the buttons
and the download/share glue. We follow the task: a component is the right call here because the
Eye-dialog and the Documentos table BOTH need the same button cluster — encapsulating it once
avoids duplicating the `navigator.canShare` branching in two callers. The dynamic-import +
`pdf().toBlob()` + anchor-click logic stays byte-for-byte faithful to `settlement-pdf-actions.ts`.

**Layering (Phase B):**

```
admin-portal-page.tsx  (route: /admin/documentos → DocumentosPage)
admin-layout.tsx       (nav item + ROUTE_TITLES + SEARCH_PLACEHOLDERS)
        │
        ▼
documentos-page.tsx  (search header + contracts browser table)
        │  reuses
        ▼
useContracts()  +  ContractPdfActions  (from contracts feature)
```

Phase B does NOT introduce a new data hook — it reuses `useContracts()` directly. This keeps
Phase B a pure presentation/wiring layer and makes it the architectural home for Phase D
(document storage) without premature abstraction.

## 3. Component design — Phase A

### 3.1 `contract-pdf-document.tsx` (new)

- Top-level `import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"`.
  Module-level doc-comment warns: load only via dynamic `import()`.
- Reuses `formatDate` and `formatMoney`-equivalent from `contract-labels`. Note: the caja
  document uses a local `fmtAmount` because React-PDF can't use the DOM Intl path the same way;
  for contracts we add a small local `fmtMoney(amount, currency)` mirroring the caja approach
  (symbol + `toLocaleString("es-AR")`). `formatDate` from `contract-labels` is safe to import
  (no DOM dependency) — the caja document already imports it.
- **Props:** a typed `ContractPdfData` object built by `contract-pdf-actions` (see 3.2). We pass
  a flattened, PDF-ready shape rather than the raw `ContractWithRelations` so the document stays
  presentational and Phase-C field additions are localized to the prop-builder.
- **Style:** clone the caja `StyleSheet` (Helvetica, A4 portrait, padding 40, navy `#1a1a2e`,
  slate accents). Header band with agency `legal_name` + address/cuit/phone/email + logo on the
  right (graceful "—" when absent), exactly like the comprobante.
- **Sections rendered:**
  1. Agency header (legal_name, address, cuit, phone, email, logo) — graceful placeholders.
  2. Title: "Contrato de locación" + subtitle line (property address, status label).
  3. Partes: Locador (name/DNI — "—" in Phase A), Locatario (tenant.name, DNI "—"),
     Garante (only if `guarantors.length > 0`; name/DNI "—" until Phase C).
  4. Inmueble: address; type/rooms/sqm rendered as "—" until Phase C.
  5. Términos: start_date, end_date, duration (months, derived), rent_amount+currency,
     adjustment_index label + adjustment_period_months, next_adjustment_date,
     deposit_amount, expenses_paid_by label, commission_amount, status label.
  6. Notas: `notes` when present.
  7. Footer: "Generado el {date}" + "Documento generado automáticamente".
- **Defensive rendering:** every optional field guarded; no throw when data is null. This mirrors
  the caja document's `agencyName ? ... : null` pattern.

### 3.2 `contract-pdf-actions.tsx` (new)

- **Props:** `{ contract: ContractWithRelations }` (per task). Internally also pulls agency
  branding via `useOrgProfile()` + `useLogoUrl(profile?.logo_path)` (same hooks the caja page
  uses) so the PDF header is branded. These hooks live in the component because it is a UI
  component (caja read them in `caja-page.tsx`); keeping them here means callers (Eye dialog +
  Documentos table) get branding for free.
- **Prop-builder:** a pure local helper `buildContractPdfData(contract, agency, logoUrl)`
  → `ContractPdfData`. Maps the available `ContractWithRelations` + `OrgProfileRow` fields,
  defaults missing party/property fields to `null`. This is the single boundary between DB shape
  and PDF shape (mirrors `buildStatementData`). Phase C extends this builder, not the document.
- **`handleDownload` / `handleShare`:** copied structurally from `settlement-pdf-actions.ts`:
  - `buildBlob`: `Promise.all([import("@react-pdf/renderer"), import("./contract-pdf-document")])`
    then `pdf(createElement(ContractPdfDocument, data)).toBlob()`.
  - `buildFilename`: `contrato-{slug(property.address || tenant.name)}.pdf` using the same
    diacritic-stripping slugify (extract `slugifyOwnerName` logic into a local `slugify` or
    reuse by importing `slugifyOwnerName` — DECISION below).
  - Download: object URL → anchor click → revoke.
  - Share: `navigator.canShare({ files })` guard → `navigator.share`, else fall back to download.
- **Render:** a "Descargar PDF" `<Button>` (always) + a "Compartir" `<Button>` shown only when
  `navigator.canShare` is available (computed once on mount via `useState`/`useEffect` to avoid
  SSR/jsdom flakiness — matches how caja conditionally renders Compartir). Loading state while
  the blob builds (disabled + spinner) is a nice-to-have, optional.

### 3.3 `contracts-list.tsx` (edit)

- Add `Eye` from `lucide-react` to the imports.
- Add a `viewContract` state (`ContractWithRelations | null`), same shape as the existing
  `editContract` state.
- Insert an Eye `<Button variant="ghost" size="sm" aria-label="Ver PDF">` as the FIRST action
  in each row's action cluster (before Generar cuotas / Editar / Eliminar), `onClick` sets
  `viewContract`.
- Render a `<Dialog>` (reuse `@/shared/components/ui/dialog`) gated on `viewContract`:
  - Header: "Contrato" + summary line (tenant name · property address · status badge · rent).
  - Body: `<ContractPdfActions contract={viewContract} />`.
  - The dialog is a thin summary + actions surface; the actual document only materializes on
    Descargar/Compartir click (download-only decision).

## 4. Component design — Phase B

### 4.1 `src/features/documentos/components/documentos-page.tsx` (new)

- Top-level page rendered at `/admin/documentos`.
- Reuses `useContracts()` directly (no new hook). Same loading / error / empty / no-results
  states as `contracts-list.tsx` (copy the four guard blocks — consistent UX).
- Search: `const query = useSearchStore((s) => s.query)`; filter with
  `matchesQuery([c.tenant?.name, c.property?.address, c.status], query)`.
- **Table columns:** Inquilino (tenant.name), Propiedad (property.address), Estado (StatusBadge),
  Alquiler (`formatMoney(rent_amount, currency)`), Inicio (formatDate start), Fin (formatDate end),
  Acciones (`<ContractPdfActions contract={contract} />` — Download/Share inline per row).
- The `StatusBadge` helper currently lives inside `contracts-list.tsx` (not exported). DECISION
  below on reuse vs. duplicate.
- No "Nuevo" button — Documentos is a read/browse surface in Phase B (creation stays in
  Contratos). Phase D adds upload UI here.

### 4.2 Portal wiring

- `admin-portal-page.tsx`: import `DocumentosPage`, add
  `<Route path="documentos" element={<DocumentosPage />} />` after the `caja` route.
- `admin-layout.tsx`:
  - Add `FolderOpen` to the lucide import.
  - Add nav item `{ to: "/admin/documentos", label: "Documentos", icon: FolderOpen }` as the
    4th-from-top position requested — placed right after Caja (per task: "4th sidebar item
    (after Caja)"). NOTE: literally placing it after Caja makes it the last data item; that
    matches "after Caja". Not `adminOnly` unless we want to gate it — DECISION below.
  - Add `SEARCH_PLACEHOLDERS["/admin/documentos"] = "Buscar por inquilino, propiedad…"`.
  - Add `ROUTE_TITLES["/admin/documentos"] = "Documentos"`.

## 5. Data flow

```
useContracts() ──► ContractWithRelations[]
        │
        ├─ Phase A: contracts-list filters → Eye dialog → ContractPdfActions(contract)
        │                                                      │
        │                                useOrgProfile/useLogoUrl + buildContractPdfData
        │                                                      ▼
        │                                  dynamic import → ContractPdfDocument → blob → download
        │
        └─ Phase B: documentos-page filters (matchesQuery) → table row → ContractPdfActions(contract)
```

No new network paths. RLS already scopes contracts to the org. Agency branding reuses the
existing private `org-branding` bucket signed-URL flow.

## 6. ADR-style decisions

### ADR-1 — `contract-pdf-actions` is a component, not a pure `.ts` module
- **Decision:** Implement actions as `contract-pdf-actions.tsx` (a React component owning the
  buttons + branding hooks + download/share glue), unlike caja which split pure `.ts` actions
  from inline JSX in `caja-page.tsx`.
- **Why:** Two callers (Eye dialog, Documentos table) need the identical button cluster +
  `navigator.canShare` branching + branding. A component encapsulates it once.
- **Rejected:** Pure `.ts` actions + duplicated JSX in both callers → duplication and drift risk.
- **Constraint preserved:** the dynamic-import + `pdf().toBlob()` logic stays faithful to
  `settlement-pdf-actions.ts`; only its packaging changes.

### ADR-2 — Flattened `ContractPdfData` prop, not raw `ContractWithRelations`
- **Decision:** A pure `buildContractPdfData()` maps DB shape → a flat PDF-ready object that the
  document renders verbatim.
- **Why:** Keeps the document presentational; localizes Phase-C field additions (owner, DNIs,
  property meta) to one builder; mirrors `buildStatementData`.
- **Rejected:** Passing `ContractWithRelations` straight into the document → document becomes
  coupled to the query shape and to Phase-C join changes.

### ADR-3 — Phase A renders graceful "—" for fields not yet in the query
- **Decision:** Locador name/DNI, locatario DNI, garante name/DNI, property type/rooms/sqm
  render as "—" in Phase A.
- **Why:** The task explicitly says Phase A skips owner and lacks DNIs; `useContracts` only
  embeds `property.address`, `tenant.name`, `guarantors.guarantor_id`. Extending the join is
  Phase C work. Shipping A without it keeps A independently shippable.
- **Rejected:** Blocking A on the Phase-C join → breaks the "A and B ship in parallel" goal.

### ADR-4 — Download-only, no in-app PDF preview
- **Decision:** The Eye dialog shows a text summary + Descargar/Compartir; it does NOT embed a
  PDF viewer.
- **Why:** Locked in the proposal; consistent with caja; avoids `@react-pdf/renderer` viewer
  bundle on the critical path; works on all browsers.
- **Rejected:** `<PDFViewer>` / iframe preview → bundle bloat + browser inconsistency.

### ADR-5 — Phase B reuses `useContracts()`, no new hook
- **Decision:** `documentos-page` consumes `useContracts()` directly.
- **Why:** Phase B is a browse surface over existing contract data; a new hook would be
  premature abstraction. Keeps Phase B a pure presentation/wiring layer.
- **Rejected:** A dedicated `useDocuments`/`useContractDocuments` hook now → no data to back it
  until Phase D.

### ADR-6 — Slugify reuse vs. duplication (NEEDS RESOLUTION AT APPLY TIME)
- **Options:** (a) import `slugifyOwnerName` from `settlement-statement-data.ts` and reuse it for
  the contract filename slug; (b) add a tiny generic `slugify` to a shared util.
- **Recommendation:** (a) for Phase A to avoid touching shared code; if a third caller appears,
  promote to `src/shared/lib`. Low risk either way.

### ADR-7 — `StatusBadge` reuse vs. duplication
- **Decision (recommended):** Extract `StatusBadge` + `CONTRACT_STATUS_LABELS` color map into a
  small exported component (e.g. `src/features/contracts/components/contract-status-badge.tsx`)
  and consume it from both `contracts-list.tsx` and `documentos-page.tsx`.
- **Why:** Phase B's table needs the exact same status pill; duplicating the color map invites
  drift.
- **Rejected:** Copy-paste the badge into documentos-page → two color maps to maintain.
- **Note:** This adds a small refactor task to Phase A/B. If the team prefers minimal Phase-A
  churn, the fallback is a local copy in documentos-page (accept the small duplication).

### ADR-8 — Documentos nav placement & visibility
- **Decision:** Add "Documentos" with `FolderOpen` after Caja. Not `adminOnly` (visible to all
  roles) unless product wants it admin-gated.
- **Why:** The task says "4th sidebar item (after Caja)"; document browsing is generally useful.
- **Open question:** Should Documentos be `adminOnly: true` like Caja? Default to NOT gated;
  flip the flag if product decides otherwise (one-line change).

## 7. Testing strategy (TDD, jsdom)

`@react-pdf/renderer` primitives do not render in jsdom — same constraint as the caja tests.
So tests follow the established caja pattern:

- **Pure builder tests:** `buildContractPdfData()` maps known fields, defaults missing party
  fields to null, never throws on null agency. (Test the boundary, not the React-PDF output.)
- **Dynamic-import boundary:** `import("./contract-pdf-document")` resolves and exports a
  function component (smoke test — module loads without crashing).
- **Actions glue:** mock `contract-pdf-actions` download/share or spy on `navigator.canShare`
  to assert Compartir visibility branching and that Descargar triggers `handleDownload`.
- **UI wiring (Phase A):** mock the PDF actions component, assert the Eye button renders per row
  and that clicking it opens the Dialog with the summary.
- **UI wiring (Phase B):** mock `useContracts`, assert the table renders rows, `matchesQuery`
  filtering narrows results, the nav item / route title exist, and Download actions render.

## 8. Risks

- `@react-pdf/renderer` must stay off the static admin bundle — verify the only import sites are
  dynamic. A static import in `contract-pdf-actions.tsx` of the document would defeat this; the
  document import MUST be dynamic inside `buildBlob`.
- Phase A "—" placeholders could read as data-loss to users; acceptable for an interim contract
  summary PDF, fully populated in Phase C. Consider a small "Borrador — datos completos en
  Contrato de Locación" note (optional).
- `StatusBadge` extraction (ADR-7) touches `contracts-list.tsx`; keep the refactor mechanical to
  avoid regressions in the existing contracts UI (tests should still pass unchanged).
- jsdom cannot exercise real `navigator.share`; share path is asserted via spies only, same as
  caja — real-device share remains a manual QA item.
