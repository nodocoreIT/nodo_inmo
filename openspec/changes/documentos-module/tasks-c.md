# Tasks: documentos-module — Phase C (Argentine contract generator)

Dependency order: T-C1 → T-C2 → T-C3 → T-C4 → T-C5 → T-C6 → T-C7 → T-C8 → T-C9

---

## [x] T-C1 — DB migration + pgTAP tests
**File:** `supabase/migrations/<timestamp>_add_contract_type_fields.sql`
**File:** `supabase/tests/170_contract_type_fields.test.sql`

Migration:
```sql
alter table nodo_inmo.contracts
  add column signing_date date,
  add column signing_city text default 'Ciudad Autónoma de Buenos Aires',
  add column contract_type text not null default 'habitacional'
    check (contract_type in ('habitacional', 'comercial'));
```

pgTAP (9 tests):
1. has_column signing_date (date)
2. has_column signing_city (text)
3. has_column contract_type (text)
4. col_not_null contract_type
5. col_has_default contract_type → 'habitacional'
6. col_has_default signing_city → 'Ciudad Autónoma de Buenos Aires'
7. throws_ok: insert contract_type='industrial'
8. lives_ok: insert contract_type='comercial'
9. Default backfill: new row → contract_type reads 'habitacional'

Run: `supabase test db supabase/tests/170_contract_type_fields.test.sql`

---

## [x] T-C2 — Apply migration + regenerate types
```bash
supabase migration up  # or supabase db reset (re-seed after)
supabase gen types typescript --local --schema public,graphql_public,shared,nodo_inmo 2>/dev/null > src/shared/types/database.ts
```
Verify `contracts` Row type has `signing_date`, `signing_city`, `contract_type`.

---

## [x] T-C3 — Extend useContracts query + ContractWithRelations type
**File:** `src/features/contracts/hooks/use-contracts.ts`

New select:
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

Add types `ContactParty`, extend `ContractWithRelations` (see design §3).

Update `use-contracts.test.tsx`: extend mock select assertion + fixture shape with `property.owner` + `tenant.dni` + `guarantors[].guarantor.dni`.

Run: `npm test -- --run`

---

## [x] T-C4 — Add 3 fields to contract-form-dialog
**File:** `src/features/contracts/components/contract-form-dialog.tsx`
**File:** `src/features/contracts/lib/contract-labels.ts` (add CONTRACT_TYPE_LABELS, PROPERTY_TYPE_LABELS)

Zod schema additions:
```ts
contract_type: z.enum(["habitacional", "comercial"]),
signing_date: z.string().optional(),
signing_city: z.string().optional(),
```

Defaults: `contract_type: contract?.contract_type ?? "habitacional"`, `signing_city: contract?.signing_city ?? "Ciudad Autónoma de Buenos Aires"`, `signing_date: contract?.signing_date ?? ""`

Payload: `contract_type`, `signing_date: values.signing_date || null`, `signing_city: values.signing_city || null`

UI: "Datos del contrato" section after expenses/status grid:
- 2-col grid: `contract_type` Select (Habitacional/Comercial) + `signing_date` Input[date]
- Full width: `signing_city` Input[text] placeholder "Ciudad Autónoma de Buenos Aires"

Update tests: `contract-form.test.tsx` — 3 new fields render, default habitacional, payload carries them.

Run: `npm test -- --run`

---

## [x] T-C5 — contract-locacion-data.ts (pure mapper)
**File:** `src/features/contracts/lib/contract-locacion-data.ts`
**File:** `src/features/contracts/lib/contract-locacion-data.test.ts`

Export `ContractParty`, `ContractDocumentData`, `buildContractDocumentData(input)`.

Pure mapper responsibilities (design §5):
- Null-coalesce all nullables to `""`
- `durationMonths` computed from start/end
- `legalMinNote` by contract_type
- `propertyTypeLabel` from PROPERTY_TYPE_LABELS
- Money formatting (`fmtAmount` — reuse settlement pattern)
- `slugifyContractName` for filename

Tests (5 fixtures): full data, missing owner, no garantes, null deposit, comercial type.

Run: `npm test -- --run`

---

## [x] T-C6 — contract-locacion-document.tsx + contract-locacion-actions.ts
**File:** `src/features/contracts/components/contract-locacion-document.tsx`
**File:** `src/features/contracts/lib/contract-locacion-actions.ts`

PDF document (design §6):
- Portrait A4, Helvetica, 10pt body, 12pt headers, 40pt margins
- Header band: agency logo + legal_name + address + CUIT
- Disclaimer band (#fff7ed background) — mandatory (design HEADLINE-3)
- Title: "CONTRATO DE LOCACIÓN" + type label
- 10 clauses (design §6 structure, exact clause text from design §7)
- Signature block (wrap={false})
- Footer: agency + generation date

Actions (design §8):
- `buildBlob(data)` — dynamic import renderer + document
- `handleDownload(data)` + `handleShare(data)` + `buildFilename(data)`

**File:** `src/features/contracts/components/contract-locacion-button.tsx`
- Reads `useOrgProfile()` + `useLogoUrl()`
- Builds `ContractDocumentData` via mapper
- Renders "Generar contrato" FileText icon button → download/share
- Loading/error states

Tests: mock dynamic imports, assert toBlob called, filename format, share fallback.

Run: `npm test -- --run`

---

## [x] T-C7 — Wire into contracts-list (Phase A)
**File:** `src/features/contracts/components/contracts-list.tsx`

Add `<ContractLocacionButton contract={row} />` in the Acciones cell (before Editar).
Keep Phase A Eye dialog — supplement, not replace.

Tests: `contracts-list.test.tsx` — FileText "Generar contrato" button present.

Run: `npm test -- --run`

---

## [x] T-C8 — Wire into documentos-page (Phase B)
**File:** `src/features/documentos/components/documentos-page.tsx`

Add `<ContractLocacionButton contract={row} />` as row action in contract browser.

Run: `npm test -- --run`

---

## [x] T-C9 — Final verification
```bash
npm test -- --run   # all tests green
npm run build       # clean build
supabase test db supabase/tests/170_contract_type_fields.test.sql  # pgTAP green
```

Report: test count, build status, pgTAP result.

---

## Review workload forecast
- Estimated lines: ~520 (migration 20 + types 30 + hook extend 40 + form 60 + mapper 80 + PDF doc 180 + actions 60 + wiring 30 + tests 120)
- Single PR — no chaining needed (all in contracts feature + shared lib)
- Risk: deep PostgREST embed (T-C3) — validate locally before proceeding to T-C5
