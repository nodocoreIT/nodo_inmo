# Design: documentos-module — Phase C (Argentine contract generator)

Technical design for **Phase C** of the documentos-module: a full **"Contrato de Locación"**
PDF template (Ley 27.551, vigente 2026), with **habitacional** and **comercial** variants.
This is the source of truth for `tasks-c.md` and `apply`.

This phase builds the contract generator in dependency order:
DB migration → extended query → form fields → PDF document → download/share actions →
wiring into the contracts list (Phase A) and the documentos page (Phase B).

It does **NOT** build: a separate wizard, e-signature, server-side rendering, contract
versioning/history, or DB-stored clause text. Clauses are static boilerplate in the React-PDF
component, conditional by `contract_type`.

---

## 0. Headline design points (read these first)

### HEADLINE-1 — The PDF is presentational and pure; it never recomputes anything

The contract document reads the contract row + embedded relations **verbatim**. Dates,
amounts, parties, property attributes are all passed in as already-resolved strings/numbers
via a single typed prop object (`ContractDocumentData`) built by a pure mapper
(`contract-locacion-data.ts`). The renderer does no DB access, no signed-URL minting, no
date math beyond formatting. This mirrors `SettlementStatementDocument` / `buildStatementData`
(ADR-5 of owner-settlement-statement) and keeps the React-PDF component unit-testable without
network or Supabase mocks.

### HEADLINE-2 — Bundle isolation: `@react-pdf/renderer` is dynamic-import only

`@react-pdf/renderer` and `contract-locacion-document.tsx` are loaded **only** via dynamic
`import()` inside the action functions (`contract-locacion-actions.ts`). They are NEVER on the
static admin bundle critical path. This is the same R-C1 invariant the settlement PDF follows
(`settlement-pdf-actions.ts`). Any static import of the document or the renderer from a
component file is a regression.

### HEADLINE-3 — Legal disclaimer is mandatory and non-removable

Every generated contract carries a prominent disclaimer: *"Este documento es un modelo
orientativo generado automáticamente. Se recomienda su revisión por un profesional del
derecho antes de la firma."* This is a hard requirement (proposal §C, risk mitigation): the
agency is not a law firm and the boilerplate is a template, not legal advice. The disclaimer
renders in the document header band, visually distinct, on the first page.

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  DB: nodo_inmo.contracts                                             │
│    + signing_date (date, null)                                      │
│    + signing_city (text, null, default CABA)                       │
│    + contract_type (text, NOT NULL, default 'habitacional',         │
│                     check habitacional|comercial)                  │
└─────────────────────────────────────────────────────────────────────┘
              │ regenerate types (database.ts)
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  useContracts() — extended PostgREST embed                          │
│    property:properties!contracts_property_id_fkey(                  │
│       address, property_type, rooms, total_sqm,                     │
│       inventory_description,                                        │
│       owner:contacts!properties_owner_id_fkey(                      │
│          name, dni, email, phone, address))                        │
│  ContractWithRelations += property.{property_type,rooms,...,owner}  │
└─────────────────────────────────────────────────────────────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────────────┐    ┌───────────────────────────────────────┐
│ contract-form-dialog │    │ contract-locacion-data.ts (pure mapper)│
│  + "Datos del         │    │  (contract + org profile + logoUrl)   │
│     contrato" section │    │     → ContractDocumentData            │
│   contract_type       │    └───────────────────────────────────────┘
│   signing_date        │                    │
│   signing_city        │                    ▼
└──────────────────────┘    ┌───────────────────────────────────────┐
                            │ contract-locacion-document.tsx (PDF)   │
                            │   (static clauses, conditional by type)│
                            └───────────────────────────────────────┘
                                             ▲ dynamic import only
                            ┌───────────────────────────────────────┐
                            │ contract-locacion-actions.ts           │
                            │   handleDownload / handleShare         │
                            └───────────────────────────────────────┘
                                  ▲                        ▲
                  ┌───────────────┘                        └───────────────┐
        ┌──────────────────────┐                  ┌──────────────────────────┐
        │ contracts-list (A)   │                  │ documentos-page (B)      │
        │  FileText row action │                  │  FileText row action     │
        └──────────────────────┘                  └──────────────────────────┘
```

---

## 2. DB Migration (ADR-1)

**File:** `supabase/migrations/<timestamp>_add_contract_type_fields.sql`

```sql
-- nodo_inmo.contracts — Phase C: contract-generator metadata
--
-- Adds the three fields the "Contrato de Locación" PDF needs that are not yet
-- captured by the contract row: the legal contract type (habitacional vs
-- comercial — drives which static clauses render), and the signing place/date
-- printed on the signature block.
--
-- contract_type is NOT NULL with a default so every existing row backfills to
-- 'habitacional' (the dominant case) without a separate UPDATE. signing_date /
-- signing_city are nullable — they are often unknown at draft time and the PDF
-- prints a blank line ("____") when absent.

alter table nodo_inmo.contracts
  add column signing_date date,
  add column signing_city text default 'Ciudad Autónoma de Buenos Aires',
  add column contract_type text not null default 'habitacional'
    check (contract_type in ('habitacional', 'comercial'));
```

**Decisions:**
- `contract_type` NOT NULL + DEFAULT `'habitacional'` → existing rows backfill automatically;
  a CHECK constraint guards the two legal values. The default mirrors the proposal's locked
  decision and the form default.
- `signing_city` carries a column DEFAULT of `'Ciudad Autónoma de Buenos Aires'` (CABA) but is
  **nullable** — a new row inserted without the field gets CABA; an explicitly-cleared field
  stays null and the PDF falls back to a blank line.
- `signing_date` nullable, no default — signing date is genuinely unknown until the parties
  meet; PDF prints `____` when null.
- Single `alter table ... add column, add column, add column` statement (one DDL transaction)
  to match the repo's compact migration style.

**pgTAP tests** — new file `supabase/tests/170_contract_type_fields.test.sql`:
1. `has_column('nodo_inmo', 'contracts', 'signing_date', ...)`
2. `has_column('nodo_inmo', 'contracts', 'signing_city', ...)`
3. `has_column('nodo_inmo', 'contracts', 'contract_type', ...)`
4. `col_type_is(...)` for each (`date`, `text`, `text`)
5. `col_not_null('nodo_inmo','contracts','contract_type', ...)`
6. `col_has_default('nodo_inmo','contracts','contract_type', ...)` and value is `'habitacional'`
7. `col_has_default('nodo_inmo','contracts','signing_city', ...)`
8. CHECK constraint: inserting `contract_type='industrial'` raises (`throws_ok`); inserting
   `'comercial'` succeeds (`lives_ok`).
9. Default backfill: insert a contract with only required columns → `contract_type` reads
   `'habitacional'`, `signing_city` reads CABA.

**Provenance:** Per `design.md` of the sibling change, SQL iterates via the Supabase MCP
`execute_sql` against the shared project, then is committed as a migration via `supabase db pull`.
For local dev, apply with `supabase db reset` (or `supabase migration up`) on Node 22 — see the
"local dev supabase gotchas" memory (db reset wipes admin; re-seed after).

---

## 3. Extended `useContracts` query (ADR-2)

**File:** `src/features/contracts/hooks/use-contracts.ts`

The owner data lives on `properties.owner_id → contacts`. The contract already embeds the
property; Phase C deepens that embed to pull owner fields and the additional property attributes
the "Objeto" clause needs.

**New select string:**
```ts
.select(
  "*, " +
  "property:properties!contracts_property_id_fkey(" +
    "address, property_type, rooms, total_sqm, inventory_description, " +
    "owner:contacts!properties_owner_id_fkey(name, dni, email, phone, address)" +
  "), " +
  "tenant:contacts!contracts_tenant_id_fkey(name, dni, address), " +
  "guarantors:contract_guarantors(guarantor_id, guarantor:contacts!contract_guarantors_guarantor_id_fkey(name, dni, address))"
)
```

**Decisions:**
- FK constraint names are **explicit** in the embed (`properties_owner_id_fkey`,
  `contracts_tenant_id_fkey`, etc.) — this is the repo convention and avoids PostgREST
  ambiguity when multiple FKs could match. The owner FK name is `properties_owner_id_fkey`
  (renamed in `20260603005247_generalize_owners_to_contacts.sql`, confirmed against the FK
  history; the migration renamed `owners → contacts` but kept the constraint name pointing at
  contacts).
- `tenant` and `guarantors` are deepened to carry `dni` and `address` too — the "Partes" clause
  needs locatario DNI/domicilio and each garante's DNI/domicilio, not just the name. This is
  additive; existing consumers (`contracts-list`, form prefill) read only the fields they used
  before.
- Owner is nullable end-to-end: `property` can be null, `property.owner` can be null
  (`properties.owner_id` is nullable). The mapper and PDF render `"—"` placeholders, never throw.

**Extended type:**
```ts
export type ContactParty = {
  name: string;
  dni: string | null;
  address: string | null;
};

export type ContractWithRelations = ContractRow & {
  property:
    | {
        address: string;
        property_type: string;
        rooms: number | null;
        total_sqm: number | null;
        inventory_description: string | null;
        owner: (ContactParty & { email: string | null; phone: string | null }) | null;
      }
    | null;
  tenant: ContactParty | null;
  guarantors: { guarantor_id: string; guarantor: ContactParty | null }[];
};
```

`ContractRow` now includes `signing_date`, `signing_city`, `contract_type` after the type
regeneration (T-C2), so no separate field additions are needed on the type.

**Risk (R-C-1):** Deeply nested PostgREST embed (3 levels: contract → property → owner). Test
with a real fixture that has owner + guarantors and one that has neither. The existing
`use-contracts.test.tsx` mocks the Supabase builder chain — extend its `select` assertion and
its returned fixture shape.

---

## 4. Contract form dialog — new fields (ADR-3)

**File:** `src/features/contracts/components/contract-form-dialog.tsx`

Add a **"Datos del contrato"** section. Placement: after the `expenses_paid_by`/`status` grid,
before the Garantes fieldset and Notas (the proposal said "after status, before notes").

**Zod schema additions:**
```ts
contract_type: z.enum(["habitacional", "comercial"]),
signing_date: z.string().optional(),
signing_city: z.string().optional(),
```

**Defaults (in `defaultValues`):**
```ts
contract_type: (contract?.contract_type as any) ?? "habitacional",
signing_date: contract?.signing_date ?? "",
signing_city: contract?.signing_city ?? "Ciudad Autónoma de Buenos Aires",
```

**`buildPayload` additions:**
```ts
contract_type: values.contract_type,
signing_date: values.signing_date || null,
signing_city: values.signing_city || null,
```

**UI (new section, inside the form, between status grid and Garantes fieldset):**
- Section heading: a small `<p className="text-sm font-medium">Datos del contrato</p>` (matches
  the Garantes `<legend>` weight).
- Grid `grid-cols-2`:
  - `contract_type`: `Select` (FormField) — items: Habitacional / Comercial. Required, default
    habitacional. `id="contract-type-trigger"`, `aria-label="Tipo de contrato"`.
  - `signing_date`: `Input type="date"` (FormField, optional). `id="signing-date-input"`,
    `aria-label="Fecha de firma"`.
- Full-width below:
  - `signing_city`: `Input type="text"` (FormField, optional), placeholder
    `"Ciudad Autónoma de Buenos Aires"`. `id="signing-city-input"`, `aria-label="Ciudad de firma"`.

A new label map `CONTRACT_TYPE_LABELS` goes in `contract-labels.ts`:
```ts
export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  habitacional: "Habitacional",
  comercial: "Comercial",
};
```

**Note:** The form dialog is the *only* place these three fields are captured — no separate
wizard (locked decision). `create-contract-dialog.tsx` already wraps `ContractFormDialog`, so
create and edit both get the fields with zero extra work there beyond passing through the new
payload keys (verify the create/update mutation hooks pass them — they spread `...payload`).

---

## 5. Contract document data mapper (ADR-4, new — keeps the renderer pure)

**File:** `src/features/contracts/lib/contract-locacion-data.ts`

A pure mapper, the single boundary between DB rows and the PDF, exactly like
`settlement-statement-data.ts`.

```ts
export interface ContractParty {
  name: string;
  dni: string;       // "" when null → renderer prints "—"
  address: string;
}

export interface ContractDocumentData {
  // Agency header
  agencyName: string;
  agencyAddress: string;
  cuit: string;
  logoUrl: string | null;
  // Type + meta
  contractType: "habitacional" | "comercial";
  contractTypeLabel: string;        // "Habitacional" | "Comercial"
  // Parties
  locador: ContractParty;           // property owner
  locatario: ContractParty;         // tenant
  garantes: ContractParty[];
  // Objeto
  propertyAddress: string;
  propertyTypeLabel: string;        // "Departamento" | "Casa" | "Local comercial" | ...
  rooms: string;                    // "" when null
  sqm: string;                      // "120.00" or ""
  inventoryDescription: string;     // "" when null
  // Plazo
  startDate: string;                // dd/mm/yyyy
  endDate: string;                  // dd/mm/yyyy
  durationMonths: number;           // computed from start/end
  legalMinNote: string;             // "El plazo mínimo legal es de 3 años (Ley 27.551)."
  // Canon
  rentAmount: string;               // "$ 250.000 ARS"
  currency: string;
  adjustmentIndexLabel: string;     // "IPC" | "ICL" | "Fijo" | "Dólar"
  adjustmentPeriodMonths: number;
  // Depósito
  depositAmount: string;            // "$ 250.000 ARS" or "—"
  // Servicios
  expensesPaidByLabel: string;      // "Inquilino" | "Propietario"
  // Firma
  signingCity: string;              // signing_city or "" → "____"
  signingDate: string;              // dd/mm/yyyy or "" → "____"
}

export function buildContractDocumentData(input: {
  contract: ContractWithRelations;
  agency: OrgProfileRow | null;
  logoUrl: string | null;
}): ContractDocumentData
```

**Responsibilities (pure, deterministic):**
- Null-coalesce every nullable to `""` (renderer turns `""` into `"—"` or `"____"`).
- `durationMonths`: `monthsBetween(start_date, end_date)` — rounded month delta. Pure helper,
  unit-tested separately.
- `legalMinNote`: habitacional → 3 años; comercial → 2 años (mentioned as a note, not enforced).
- `propertyTypeLabel`: map `apartment→Departamento, house→Casa, commercial→Local comercial,
  land→Terreno, other→Otro` (new `PROPERTY_TYPE_LABELS` in contract-labels.ts).
- Money formatting reuses the React-PDF-safe `fmtAmount(amount, currency)` style from the
  settlement document (es-AR locale, symbol prefix).
- `slugifyContractName(contract)` → filename slug from tenant + property address.

The mapper is exported and unit-tested with fixtures (full data, missing owner, missing
guarantors, null deposit, comercial type). The renderer is then trivial.

---

## 6. Contract PDF document (ADR-5)

**File:** `src/features/contracts/components/contract-locacion-document.tsx`

A `@react-pdf/renderer` component. Portrait A4, Helvetica, 10pt body, 12pt section headers,
standard 40pt margins. Top-level `import "@react-pdf/renderer"` — **dynamic-import only**, with
the same warning header comment as the settlement document.

**Structure (all Spanish):**

1. **Header band** — agency logo (right, from signed `logoUrl`) + `agencyName` (legal_name) +
   `agencyAddress` + `CUIT: <cuit>`. Graceful `"—"` placeholders when absent.
2. **Disclaimer band** — boxed, distinct background (`#fff7ed` warning tint), the mandatory
   disclaimer text (HEADLINE-3).
3. **Title** — `CONTRATO DE LOCACIÓN` + subtitle `Destino: <contractTypeLabel>`.
4. **Cláusula PRIMERA — PARTES** — Locador (name, DNI, domicilio), Locatario (name, DNI,
   domicilio), Garante(s) listed if present.
5. **Cláusula SEGUNDA — OBJETO** — property address, tipo, ambientes (rooms), superficie (sqm),
   destino (uso), and inventory description if present.
6. **Cláusula TERCERA — PLAZO** — start, end, duration in months + `legalMinNote`.
7. **Cláusula CUARTA — CANON LOCATIVO** — rent amount + currency, índice de ajuste +
   periodicidad, día de pago (día 1 a 10 de cada mes).
8. **Cláusula QUINTA — DEPÓSITO EN GARANTÍA** — deposit amount + habitacional note (máx 1 mes).
9. **Cláusula SEXTA — SERVICIOS Y EXPENSAS** — `expensesPaidByLabel`.
10. **Cláusula SÉPTIMA — OBLIGACIONES Y USO** (conditional by `contract_type`) — see §7 for the
    exact static text.
11. **Cláusula OCTAVA — RESCISIÓN ANTICIPADA** (conditional) — see §7.
12. **Cláusula NOVENA — CONSERVACIÓN Y DEVOLUCIÓN** (shared) — see §7.
13. **Cláusula DÉCIMA — FUERO COMPETENTE** — justicia ordinaria del lugar del inmueble.
14. **Firma** — `En <signingCity>, a los <signingDate>.` + three signature lines: Locador,
    Locatario, Garante (one extra line per additional garante).
15. **Footer** — `Generado por <agencyName> — <fecha de generación>` (auto date, es-AR).

The clause blocks 10–12 are rendered via a small static-text helper keyed by `contractType`.
Use `wrap` and `break` props so long contracts paginate cleanly; the signature block uses
`wrap={false}` so it never splits across a page boundary.

---

## 7. Static Argentine contract clause text (canonical — used by T-C5)

> All clause text below is the **exact** Spanish boilerplate to hardcode in
> `contract-locacion-document.tsx`. Dynamic values (`<...>`) come from `ContractDocumentData`.
> This is a generic orientative template under Ley 27.551 (locaciones), NOT legal advice.

### Disclaimer (always, both types)
```
Este documento es un modelo orientativo generado automáticamente. Se recomienda su revisión
por un profesional del derecho antes de la firma. La inmobiliaria no asume responsabilidad
por el contenido legal del presente modelo.
```

### Cláusula SÉPTIMA — OBLIGACIONES Y USO

**Habitacional:**
```
SÉPTIMA — DESTINO Y USO: El inmueble se destina exclusivamente a vivienda del LOCATARIO y su
grupo familiar conviviente, quedando prohibido darle un destino distinto al habitacional. El
LOCATARIO no podrá ceder ni transferir el presente contrato, ni subarrendar total o
parcialmente el inmueble, sin el consentimiento previo y por escrito del LOCADOR. El LOCATARIO
se obliga a habitar el inmueble en forma personal y a no alterar su estructura ni destino.
```

**Comercial:**
```
SÉPTIMA — DESTINO Y USO: El inmueble se destina exclusivamente a la actividad comercial
declarada por el LOCATARIO, quien manifiesta contar con las habilitaciones que correspondan,
siendo a su exclusivo cargo la obtención y el mantenimiento de las mismas. Queda prohibida la
cesión o transferencia del contrato, así como el subarriendo total o parcial, sin autorización
previa y por escrito del LOCADOR. Todo cambio de destino o de rubro requerirá conformidad
expresa del LOCADOR.
```

### Cláusula OCTAVA — RESCISIÓN ANTICIPADA

**Habitacional (Ley 27.551, art. 13):**
```
OCTAVA — RESCISIÓN ANTICIPADA: El LOCATARIO podrá, transcurridos los primeros SEIS (6) meses
de vigencia de la relación locativa, resolver el contrato debiendo notificar en forma
fehaciente su decisión al LOCADOR con una antelación mínima de UN (1) mes. Si hace uso de la
opción resolutoria durante el primer año de vigencia, deberá abonar al LOCADOR, en concepto de
indemnización, la suma equivalente a UN (1) mes y medio de alquiler al momento de desocupar el
inmueble; y la de UN (1) mes si la opción se ejercita transcurrido dicho lapso. En los casos
en que el LOCATARIO notifique con una antelación mínima de TRES (3) meses, no corresponderá el
pago de indemnización alguna una vez transcurridos los primeros SEIS (6) meses del contrato.
```

**Comercial:**
```
OCTAVA — RESCISIÓN ANTICIPADA: Cualquiera de las partes podrá rescindir anticipadamente el
presente contrato notificando su decisión en forma fehaciente a la otra parte con una
antelación mínima de SESENTA (60) días corridos. La rescisión ejercida por el LOCATARIO antes
del vencimiento del plazo pactado dará derecho al LOCADOR a percibir la indemnización que las
partes acuerden en el presente, sin perjuicio de las obligaciones devengadas hasta la efectiva
restitución del inmueble.
```

### Cláusula NOVENA — CONSERVACIÓN Y DEVOLUCIÓN (shared, both types)
```
NOVENA — CONSERVACIÓN Y DEVOLUCIÓN: El LOCATARIO recibe el inmueble en buen estado de
conservación y se obliga a mantenerlo y conservarlo en igual estado, respondiendo por todo
deterioro que no provenga del uso normal y del transcurso del tiempo. Deberá notificar al
LOCADOR, de forma inmediata y fehaciente, todo desperfecto o deterioro que requiera reparación
a cargo del LOCADOR. Al finalizar la locación, el LOCATARIO restituirá el inmueble en el mismo
estado en que lo recibió, libre de ocupantes y con sus servicios al día.
```

### Cláusula DÉCIMA — FUERO COMPETENTE (shared)
```
DÉCIMA — JURISDICCIÓN: Para todos los efectos legales derivados del presente contrato, las
partes se someten a la jurisdicción de los tribunales ordinarios competentes correspondientes
al lugar de ubicación del inmueble, renunciando a cualquier otro fuero o jurisdicción que
pudiera corresponderles.
```

### Plazo legal notes (in Cláusula TERCERA)
- Habitacional: `El plazo mínimo legal para destino habitacional es de TRES (3) años (art. 1198 CCCN, Ley 27.551).`
- Comercial: `El plazo mínimo legal para destino comercial es de DOS (2) años (art. 1198 CCCN).`

### Depósito note (in Cláusula QUINTA, habitacional only)
```
El depósito en garantía no podrá exceder el equivalente al primer mes de alquiler y será
reintegrado al finalizar la locación, conforme art. 1196 CCCN (Ley 27.551).
```

---

## 8. Download / Share actions (ADR-6)

**File:** `src/features/contracts/components/contract-locacion-actions.ts`

Exact same pattern as `settlement-pdf-actions.ts`:
```ts
async function buildBlob(data: ContractDocumentData): Promise<Blob> {
  const [{ pdf }, { ContractLocacionDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/features/contracts/components/contract-locacion-document"),
  ]);
  return pdf(React.createElement(ContractLocacionDocument, data)).toBlob();
}
```
- `handleDownload(data)` — `pdf().toBlob()` → object URL → anchor click → revoke.
- `handleShare(data)` — `navigator.canShare({files})` → `navigator.share`, desktop falls back
  to download.
- `buildFilename(data)` → `contrato-locacion-<tenant-slug>-<property-slug>.pdf`.

**Plus a thin React component** `contract-locacion-button.tsx` (or inline in the list) that:
1. Reads `useOrgProfile()` + `useLogoUrl(profile?.logo_path)`.
2. Builds `ContractDocumentData` via `buildContractDocumentData`.
3. Renders a `FileText` icon button "Generar contrato" + a Download/Share menu, calling the
   actions. Reused by both contracts-list (A) and documentos-page (B).

> NOTE on file extension: actions are pure TS (`.ts`); the button/trigger that uses hooks is
> `.tsx`. This separates the dynamic-import boundary (TS, no JSX) from the React glue.

---

## 9. Wiring (ADR-7)

**T-C7 — contracts-list (Phase A):** Add a `FileText` ghost icon button in the Acciones cell,
before Editar. Phase A added a contract-summary "Eye" dialog with a basic "Descargar PDF"; Phase
C **supplements** it with the full "Generar contrato" action (does not remove the Eye preview).
The button is gated by available data: enabled always (renders `"—"` placeholders when owner /
fields are missing), so the agent can generate even an incomplete draft.

**T-C8 — documentos-page (Phase B):** Phase B's `/admin/documentos` contract browser gets the
same `FileText` "Generar contrato" row action wired to the shared button/actions. This is the
"full contract generator" home referenced in the proposal. (If Phase B is not yet implemented
when Phase C runs, T-C8 is deferred and noted as a dependency in tasks-c.md.)

---

## 10. Testing strategy (TDD — strict mode active)

| Layer | Test | RED first |
|-------|------|-----------|
| Migration | `170_contract_type_fields.test.sql` (pgTAP) | columns/constraint/default |
| Query | `use-contracts.test.tsx` — assert deepened select string + owner in fixture | new embed |
| Mapper | `contract-locacion-data.test.ts` — full / missing-owner / no-garantes / null-deposit / comercial | pure, no mocks |
| Form | `edit-contract.test.tsx` + new assertions — 3 fields render, default habitacional, payload carries them | field presence |
| Actions | `contract-locacion-actions.test.ts` — mock dynamic imports, assert toBlob called + filename | mocked `pdf()` |
| List wiring | `contracts-list.test.tsx` — FileText button present, click triggers action | button render |

The PDF **renderer** itself is exercised indirectly through the mapper + actions tests (mock
`@react-pdf/renderer`'s `pdf`). We do NOT snapshot-render the full PDF (brittle); we assert the
mapper output (the load-bearing data) and the bundle-isolation contract.

---

## 11. ADR summary

| ADR | Decision | Rationale | Rejected alternative |
|-----|----------|-----------|----------------------|
| ADR-1 | 3 columns via single `alter table`, `contract_type` NOT NULL+default, CHECK | Auto-backfill, type safety, matches repo style | Separate `contract_metadata` table — overkill, 1:1 with contracts |
| ADR-2 | Deepen `useContracts` embed (owner via `properties_owner_id_fkey`) | One query, RLS-scoped, no extra round-trips | Separate `useContractParties(id)` hook — N+1 + more code |
| ADR-3 | Fields in existing form dialog | Locked decision; save to DB, regenerate anytime | Separate wizard — duplicate state, worse UX |
| ADR-4 | Pure mapper `contract-locacion-data.ts` between DB and PDF | Renderer testable without mocks; mirrors settlement | Mapping inside the React-PDF component — untestable, impure |
| ADR-5 | Static clauses in the PDF component, conditional by type | Locked decision; legal text is template, not data | DB-stored clauses — versioning/migration burden, no benefit now |
| ADR-6 | Dynamic-import-only actions (`.ts`) + thin `.tsx` button | R-C1 bundle isolation; reuse across A & B | Static import — bloats admin critical-path bundle |
| ADR-7 | Supplement (not replace) Phase A Eye preview | Non-breaking; both flows coexist | Replace Eye dialog — loses the lightweight summary view |

## 12. Risks

- **R-C-1** — Deep 3-level PostgREST embed; FK constraint name `properties_owner_id_fkey` must
  be correct or PostgREST errors. Mitigation: integration-style test against local DB after T-C2.
- **R-C-2** — Legal accuracy: the boilerplate is a generic Ley 27.551 template; rescisión figures
  (1.5 / 1 mes) reflect art. 13 as commonly drafted. Mandatory disclaimer (HEADLINE-3) is the
  mitigation; not a substitute for counsel.
- **R-C-3** — `signing_city` nullable vs column default: a row inserted via the form with an
  empty field saves `null` (payload maps `"" → null`), so the PDF prints `____`. Confirm this is
  desired (it is — blank line for hand-completion).
- **R-C-4** — Phase B page may not exist when C runs → T-C8 becomes a deferred dependency.
- **R-C-5** — `@react-pdf/renderer` v4.x StyleSheet quirks (no `gap` in some versions, limited
  flex). Follow the exact patterns proven in `settlement-statement-document.tsx`.
