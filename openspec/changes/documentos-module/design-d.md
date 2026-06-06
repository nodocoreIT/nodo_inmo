# Design: documentos-module — Phase D (Document Storage)

## Scope

New `nodo_inmo.documents` table, private `org-documents` Storage bucket, three hooks
(`useDocuments`, `useUploadDocument`, `useDeleteDocument`), an `UploadDocumentDialog`
component, and a Documents section inside the existing `DocumentosPage` (Phase B).

---

## ADR-D1 — Table lives in `nodo_inmo`, NOT in a shared schema

**Decision**: `CREATE TABLE nodo_inmo.documents`.

**Rationale**: All agency-specific business tables live in `nodo_inmo` (contracts,
property_expenses, owner_settlements). Shared schema holds cross-tenant scaffolding only
(organizations, members). Phase D documents are agency-owned content.

**Rejected**: `shared.documents` — would require cross-schema joins and break the clean
boundary between scaffolding and business logic.

---

## ADR-D2 — Template B RLS (admin-only, org-scoped)

**Decision**: Identical RLS pattern as `property_expenses` and `caja`.
Four policies: `admin_select`, `admin_insert`, `admin_update`, `admin_delete`.
InitPlan-friendly form: `(select auth.jwt()) -> 'app_metadata' ->> 'org_id'` and `role`
sub-selects are evaluated once per statement, not once per row.

**Rationale**: Documents are agency-internal records (facturas, presupuestos). Tenants and
agents must not see them. This matches the RLS contract used across all financial tables.

**Rejected**: Template A (org-scoped without role check) — agents would have read access,
which is unacceptable for documents that may contain pricing or tax data.

---

## ADR-D3 — Separate bucket `org-documents`, not reusing `property-expense-receipts`

**Decision**: New private bucket `org-documents`.

**Rationale**: Documents attached to contracts or free-floating (no property) cannot live
in `property-expense-receipts` whose path structure is `{org_id}/{property_id}/...`.
Documents need a flat `{org_id}/{uuid}-{filename}` path. Mixing concerns in one bucket
would require divergent path parsing in RLS policies.

**Rejected**: Reuse `property-expense-receipts` — naming is wrong, path convention breaks,
RLS policy logic would become conditional. One bucket, one concern.

---

## ADR-D4 — `useUploadDocument` is a single composite mutation (upload + insert)

**Decision**: One `useMutation` that (1) uploads the file to Storage, (2) inserts the DB
row with `file_path` returned by step 1. The mutation is NOT split into two hooks.

**Rationale**: Atomicity at the UX level. If the DB insert fails after the upload, the
orphaned file is acceptable (cleanup via background job or manual Supabase console) — this
is the same tradeoff made in `useUploadReceipt` + `useCreateExpense`. The combined hook
is simpler to test: mock both calls, assert row is written with the returned key.

**Rejected**: Two separate hooks composed in the dialog — would require the dialog to
orchestrate two async operations with intermediate state, increasing error surface and
duplication of loading/error handling.

---

## ADR-D5 — `document_type` is a DB check constraint, NOT a Postgres enum

**Decision**: `CHECK (document_type IN ('factura','presupuesto','certificado','otro'))`.

**Rationale**: Consistent with `property_expenses.type` and `contracts.contract_type` (Phase C).
Check constraints are simpler to extend (no `ALTER TYPE ... ADD VALUE`). The TypeScript layer
defines a `DocumentType` union type derived from the check values.

**Rejected**: Postgres enum — adds schema migration complexity for future value additions
(e.g., `acta_entrega`, `poliza_seguro`) with no performance benefit at this row volume.

---

## ADR-D6 — Nullable `property_id` and `contract_id` (mutually optional, not mutually exclusive)

**Decision**: Both FKs are nullable. A document may be associated with a property, a
contract, both, or neither (org-level document).

**Rationale**: Real-world agency documents span all cases: a presupuesto can be linked to a
property before any contract exists; a factura may be relevant to a contract but not a
specific property; a certificado de habilitación is org-level.

**Rejected**: Exactly-one constraint (only property OR contract) — overly restrictive, would
require a CHECK constraint that becomes a maintenance liability as use cases grow.

---

## ADR-D7 — Signed URL at read time (60 s TTL), never store public URLs

**Decision**: `useDocumentUrl(filePath)` follows the same pattern as `useReceiptUrl`:
`staleTime: 0`, 60-second TTL, `createSignedUrl` at query time. Never `getPublicUrl`.

**Rationale**: Bucket is private (`public = false`). Public URL generation returns a usable
URL despite the private flag only when bucket auth is misconfigured — this is a security
footgun. Signed URLs respect the storage RLS policy (admin + org path check).

---

## Component Architecture

```
DocumentosPage (Phase B, already exists)
├── [existing] ContractsBrowser section
└── [new] DocumentsSection
    ├── UploadDocumentDialog
    │   ├── label input (required)
    │   ├── document_type select
    │   ├── property_id select (from useProperties, optional)
    │   ├── contract_id select (from useContracts, optional)
    │   ├── notes textarea (optional)
    │   └── file input (PDF/JPEG/PNG, max 10 MB)
    └── DocumentsTable
        ├── DocumentRow (per row)
        │   ├── label
        │   ├── DocumentTypeBadge (color-coded)
        │   ├── association display (property address | contract tenant | —)
        │   ├── uploaded_at (formatted)
        │   ├── DownloadButton → useDocumentUrl → window.open (signed URL)
        │   └── DeleteButton (admin-only) → useDeleteDocument
        └── empty state
```

---

## Data Flow

### Upload

```
UploadDocumentDialog.onSubmit
  → useUploadDocument.mutate({ file, label, document_type, property_id?, contract_id?, notes? })
      → supabase.storage.from('org-documents').upload(`${orgId}/${uuid}-${filename}`)
      → supabase.schema('nodo_inmo').from('documents').insert({ org_id, file_path, label, ... })
      → queryClient.invalidateQueries(DOCUMENTS_QUERY_KEY)
  → dialog closes, list refreshes
```

### Read

```
DocumentsSection.mount
  → useDocuments({ property_id?, contract_id? })
      → supabase.schema('nodo_inmo').from('documents')
          .select('*, property:properties(address), contract:contracts(id)')
          .order('uploaded_at', { ascending: false })
  → DocumentsTable renders rows
```

### Download

```
DocumentRow DownloadButton.onClick
  → useDocumentUrl(row.file_path)  [staleTime: 0 → always fresh]
      → supabase.storage.from('org-documents').createSignedUrl(filePath, 60)
  → window.open(signedUrl, '_blank')
```

### Delete

```
DocumentRow DeleteButton.onClick
  → useDeleteDocument.mutate({ id, file_path })
      → supabase.storage.from('org-documents').remove([file_path])
      → supabase.schema('nodo_inmo').from('documents').delete().eq('id', id)
      → queryClient.invalidateQueries(DOCUMENTS_QUERY_KEY)
```

---

## File Layout

```
src/features/documentos/
  hooks/
    use-documents.ts           # useDocuments query
    use-upload-document.ts     # useUploadDocument composite mutation
    use-delete-document.ts     # useDeleteDocument mutation
    use-document-url.ts        # useDocumentUrl signed URL query
  components/
    upload-document-dialog.tsx # UploadDocumentDialog
    documents-table.tsx        # DocumentsTable + DocumentRow
    document-type-badge.tsx    # DocumentTypeBadge (color-coded Shadcn Badge)
    documents-section.tsx      # DocumentsSection (glue: table + upload button)

supabase/migrations/
  20260606000001_create_documents.sql   # table + indexes + RLS + bucket + storage policies + pgTAP

src/shared/types/database.ts  # regenerated after migration (T-D2, no manual edit)
```

---

## Migration Structure (20260606000001_create_documents.sql)

Sections in order (mirrors property_expenses migration):

1. `CREATE TABLE nodo_inmo.documents` with check constraint
2. Indexes: `(org_id)`, `(property_id)`, `(contract_id)`
3. `updated_at` trigger reusing `nodo_inmo.set_updated_at()`
4. RLS ENABLE + 4 admin policies (Template B)
5. Storage bucket INSERT (on conflict do nothing)
6. 4 storage.objects policies (`documents_admin_select/insert/update/delete`)
7. pgTAP tests block

### Storage path convention

`{org_id}/{uuid}-{sanitized_filename}`

The first segment is `org_id` — required by the storage RLS policy which checks
`(storage.foldername(name))[1] = app_metadata.org_id`. There is no property_id or
contract_id in the path because documents may not be tied to either.

---

## Integration Points

| Phase | Dependency |
|-------|------------|
| Phase B (DocumentosPage) | DocumentsSection is added as a second `<section>` below ContractsBrowser |
| useProperties | populates property_id select in UploadDocumentDialog |
| useContracts | populates contract_id select in UploadDocumentDialog |
| shared/lib/supabase | standard Supabase client |
| useAuth | orgId for upload path and DB insert |
| @tanstack/react-query | all hooks |
| shadcn/ui | Dialog, Select, Input, Textarea, Button, Badge, Table |

---

## Risks

1. **Orphaned storage objects on DB insert failure**: upload succeeds, DB insert fails → file
   is orphaned in the bucket. Accepted tradeoff (same as property-expense-receipts pattern).
   Mitigation: wrap in try/catch in the mutation; display a clear error message; storage
   objects can be cleaned manually or via a future cleanup job.

2. **Signed URL race**: user clicks Download, hook fires `createSignedUrl`, user clicks again
   within 60 s — two signed URLs are minted. Harmless but wasteful. `staleTime: 0` means
   a fresh URL is created each click, which is correct behavior for a private bucket.

3. **Large file UX**: 10 MB cap enforced at the bucket level. The file input should validate
   client-side before upload to give immediate feedback. If skipped, Supabase returns a 413
   error that must be surfaced as a user-readable message.

4. **useDocuments filter in Phase D MVP**: the hook accepts an optional `{ property_id?, contract_id? }`
   filter but the DocumentosPage renders ALL documents (no filter UI). Filtering UI is
   deferred post-MVP. The hook signature is designed to support it when ready.
