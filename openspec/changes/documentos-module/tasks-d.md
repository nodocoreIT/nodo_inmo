# Tasks: documentos-module — Phase D (Document Storage)

## Review Workload Forecast

| Metric | Estimate |
|--------|----------|
| New files | ~10 |
| Changed files | ~2 (documentos-page.tsx, database.ts regenerated) |
| Estimated additions | ~380 lines |
| Estimated deletions | ~5 lines |
| 400-line budget risk | **Medium** |
| Chained PRs recommended | No — single PR is acceptable; scope is cohesive |
| Decision needed before apply | No |

All tasks target the `src/features/documentos/` feature module and one migration file.
No cross-feature edits except a single `<DocumentsSection />` insertion in the existing
`documentos-page.tsx`. Each task is independently testable.

---

## [x] T-D1 — DB Migration: `nodo_inmo.documents` table + bucket + pgTAP

**File**: `supabase/migrations/20260606000001_create_documents.sql`

### Schema

```sql
create table nodo_inmo.documents (
  id             uuid        primary key default gen_random_uuid(),
  org_id         uuid        not null
                             references shared.organizations(id) on delete cascade,
  property_id    uuid        references nodo_inmo.properties(id) on delete set null,
  contract_id    uuid        references nodo_inmo.contracts(id) on delete set null,
  label          text        not null,
  document_type  text        not null
                             check (document_type in ('factura','presupuesto','certificado','otro')),
  file_path      text        not null,
  notes          text,
  uploaded_at    timestamptz not null default now(),
  updated_at     timestamptz not null default clock_timestamp()
);
```

### Indexes

```sql
create index documents_org_id_idx      on nodo_inmo.documents (org_id);
create index documents_property_id_idx on nodo_inmo.documents (property_id);
create index documents_contract_id_idx on nodo_inmo.documents (contract_id);
```

### updated_at trigger

```sql
create trigger set_updated_at
  before update on nodo_inmo.documents
  for each row execute function nodo_inmo.set_updated_at();
```

### RLS (Template B — admin-only)

```sql
alter table nodo_inmo.documents enable row level security;

-- 4 policies mirroring property_expenses pattern:
-- admin_select, admin_insert, admin_update (USING + WITH CHECK), admin_delete
-- All use InitPlan-friendly sub-select form:
--   org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
--   and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
```

### Storage bucket

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-documents', 'org-documents', false, 10485760,
  array['image/jpeg','image/png','application/pdf']
)
on conflict (id) do nothing;
```

### Storage RLS (4 policies)

Policy names: `documents_admin_select`, `documents_admin_insert`,
`documents_admin_update`, `documents_admin_delete`.
All check `bucket_id = 'org-documents'` AND org path AND admin role.
UPDATE policy has both USING and WITH CHECK.
Path check: `(storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')`.

### pgTAP tests (inline at bottom of migration)

```sql
-- table exists
select has_table('nodo_inmo', 'documents', 'documents table exists');

-- required columns present
select has_column('nodo_inmo', 'documents', 'id', 'has id');
select has_column('nodo_inmo', 'documents', 'org_id', 'has org_id');
select has_column('nodo_inmo', 'documents', 'label', 'has label');
select has_column('nodo_inmo', 'documents', 'document_type', 'has document_type');
select has_column('nodo_inmo', 'documents', 'file_path', 'has file_path');
select has_column('nodo_inmo', 'documents', 'uploaded_at', 'has uploaded_at');

-- RLS enabled
select rowsecurity_is('nodo_inmo', 'documents', true, 'RLS enabled on documents');

-- 4 table-level policies
select is(
  (select count(*)::int from pg_policies where schemaname = 'nodo_inmo' and tablename = 'documents'),
  4, '4 RLS policies on documents'
);

-- check constraint rejects invalid document_type
do $$
begin
  begin
    insert into nodo_inmo.documents (org_id, label, document_type, file_path)
    values (gen_random_uuid(), 'x', 'invalid_type', 'path/to/file');
    raise 'expected constraint violation';
  exception when check_violation then null;
  end;
end $$;
select ok(true, 'document_type check constraint enforced');
```

**Acceptance**: `supabase db reset` passes with no pgTAP failures; `npx supabase gen types` produces `nodo_inmo.documents` table types.

---

## [x] T-D2 — Run migration locally + regenerate types

**Steps** (executed by implementer, not automated):

```bash
supabase db reset
npx supabase gen types typescript --local > src/shared/types/database.ts
```

**Acceptance**: `database.ts` contains `documents` key under `nodo_inmo.Tables`. TypeScript compilation has no errors related to the new table.

No test file for this task — it is a mechanical environment sync step.

---

## [x] T-D3 — `useDocuments` hook + tests

**File**: `src/features/documentos/hooks/use-documents.ts`

```typescript
export const DOCUMENTS_QUERY_KEY = ["nodo_inmo", "documents"] as const;

export interface DocumentsFilter {
  property_id?: string;
  contract_id?: string;
}

export function useDocuments(filter?: DocumentsFilter) {
  return useQuery<DocumentWithRelations[]>({
    queryKey: filter ? [...DOCUMENTS_QUERY_KEY, filter] : DOCUMENTS_QUERY_KEY,
    queryFn: async () => {
      let query = supabase
        .schema("nodo_inmo")
        .from("documents")
        .select("*, property:properties!documents_property_id_fkey(address), contract:contracts!documents_contract_id_fkey(id)")
        .order("uploaded_at", { ascending: false });

      if (filter?.property_id) query = query.eq("property_id", filter.property_id);
      if (filter?.contract_id) query = query.eq("contract_id", filter.contract_id);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as DocumentWithRelations[];
    },
  });
}
```

**Test file**: `src/features/documentos/hooks/use-documents.test.ts`

Test cases:
- Returns empty array when Supabase returns `[]`
- Returns mapped rows when data is present
- Applies `property_id` filter to query when provided
- Applies `contract_id` filter to query when provided
- Throws when Supabase returns an error
- Query key includes filter object when filter is provided
- Query key is base key when no filter

Mock strategy: `vi.mock('@/shared/lib/supabase')` — mock `supabase.schema().from().select().order()` chain; mock `.eq()` calls on the filtered path.

**Acceptance**: All 7 tests pass. `useDocuments` is exported from `src/features/documentos/hooks/index.ts`.

---

## [x] T-D4 — `useUploadDocument` composite mutation + tests

**Files**:
- `src/features/documentos/hooks/use-upload-document.ts`
- `src/features/documentos/hooks/use-upload-document.test.ts`

```typescript
const BUCKET = "org-documents";

export interface UploadDocumentInput {
  file: File;
  label: string;
  document_type: DocumentType;
  property_id?: string;
  contract_id?: string;
  notes?: string;
}

export function useUploadDocument() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadDocumentInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      // 1. Upload file
      const key = `${orgId}/${crypto.randomUUID()}-${sanitizeFilename(input.file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(key, input.file, { upsert: false });
      if (uploadError) throw uploadError;

      // 2. Insert DB row
      const { data, error: insertError } = await supabase
        .schema("nodo_inmo")
        .from("documents")
        .insert({
          org_id: orgId,
          file_path: key,
          label: input.label,
          document_type: input.document_type,
          property_id: input.property_id ?? null,
          contract_id: input.contract_id ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });
}
```

**Test cases**:
- Uploads file to correct path `{orgId}/{uuid}-{sanitizedName}`
- Inserts DB row with correct fields including `file_path` returned by upload
- Throws if upload step fails (DB insert is NOT called)
- Throws if DB insert fails after successful upload (orphan scenario documented)
- Invalidates `DOCUMENTS_QUERY_KEY` on success
- Throws if `orgId` is null
- `sanitizeFilename` converts spaces and special chars to hyphens
- `sanitizeFilename` collapses consecutive hyphens

**Acceptance**: All 8 tests pass. Mutation is exported from hooks index.

---

## [x] T-D5 — `useDeleteDocument` mutation + tests

**Files**:
- `src/features/documentos/hooks/use-delete-document.ts`
- `src/features/documentos/hooks/use-delete-document.test.ts`

```typescript
export interface DeleteDocumentInput {
  id: string;
  file_path: string;
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file_path }: DeleteDocumentInput) => {
      // 1. Remove storage object
      const { error: storageError } = await supabase.storage
        .from("org-documents")
        .remove([file_path]);
      if (storageError) throw storageError;

      // 2. Delete DB row
      const { error: dbError } = await supabase
        .schema("nodo_inmo")
        .from("documents")
        .delete()
        .eq("id", id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });
}
```

**Test cases**:
- Calls `storage.remove` with the correct file_path array
- Calls DB delete with the correct id
- Throws if storage removal fails (DB delete is NOT called)
- Throws if DB delete fails after storage removal
- Invalidates `DOCUMENTS_QUERY_KEY` on success

**Acceptance**: All 5 tests pass.

---

## [x] T-D6 — `UploadDocumentDialog` component + tests

**Files**:
- `src/features/documentos/components/upload-document-dialog.tsx`
- `src/features/documentos/components/upload-document-dialog.test.tsx`

**Props**:
```typescript
interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Fields** (all inside a Shadcn `<Dialog>`):
- `label` — `<Input>` required; shows validation error if empty on submit
- `document_type` — `<Select>` with options: Factura, Presupuesto, Certificado, Otro
- `property_id` — `<Select>` optional; options from `useProperties()` (`id`, `address`)
- `contract_id` — `<Select>` optional; options from `useContracts()` (`id`, tenant name)
- `notes` — `<Textarea>` optional
- `file` — `<Input type="file">` accept=".pdf,.jpg,.jpeg,.png"; validates max 10 MB client-side
- Submit button: calls `useUploadDocument().mutate(...)`, disabled while `isPending`
- Cancel button: calls `onOpenChange(false)`
- On success: `onOpenChange(false)` (dialog closes automatically)
- On error: shows toast with error message (reuse existing `useToast()` pattern)

**Test cases**:
- Renders all fields
- Submit button is disabled when `label` is empty
- Submit button is disabled when no file is selected
- Shows file size error when file > 10 MB before submitting
- Calls `useUploadDocument().mutate` with correct payload on valid submit
- Closes dialog (`onOpenChange(false)`) after successful mutation
- Shows error toast when mutation throws
- Renders property options from `useProperties()`
- Renders contract options from `useContracts()`

Mock strategy: mock `useUploadDocument`, `useProperties`, `useContracts`. Use `@testing-library/react` with `renderWithProviders`.

**Acceptance**: All 9 tests pass.

---

## [x] T-D7 — `DocumentsSection` + `DocumentsTable` + `DocumentTypeBadge` + integration in DocumentosPage

**Files**:
- `src/features/documentos/components/document-type-badge.tsx`
- `src/features/documentos/components/documents-table.tsx`
- `src/features/documentos/components/documents-section.tsx`
- Modified: `src/pages/admin/documentos-page.tsx` (add `<DocumentsSection />`)

### `DocumentTypeBadge`

```typescript
const TYPE_COLORS: Record<DocumentType, string> = {
  factura:      "bg-blue-100 text-blue-800",
  presupuesto:  "bg-yellow-100 text-yellow-800",
  certificado:  "bg-green-100 text-green-800",
  otro:         "bg-gray-100 text-gray-800",
};
```

Renders a Shadcn `<Badge>` with the color variant and capitalized label.

### `DocumentsTable`

Shadcn `<Table>` columns: Label | Type | Association | Date | Actions.

- **Association**: if `property?.address` → shows address; else if `contract?.id` → shows
  tenant name (embed `tenant:contacts(name)` in `useDocuments` select); else `—`.
- **Date**: `uploaded_at` formatted as `dd/MM/yyyy`.
- **Actions**: Download button (calls `useDocumentUrl`, then `window.open`); Delete button
  (calls `useDeleteDocument`, admin-only).
- Empty state: "No hay documentos cargados aún." centered row.

### `DocumentsSection`

```typescript
export function DocumentsSection() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: documents, isLoading } = useDocuments();

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <Button onClick={() => setUploadOpen(true)}>Subir documento</Button>
      </div>
      <DocumentsTable documents={documents ?? []} isLoading={isLoading} />
      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </section>
  );
}
```

### `documentos-page.tsx` change

Add one line after the existing `<ContractsBrowser />` section:

```tsx
<DocumentsSection />
```

**Test files**:
- `src/features/documentos/components/document-type-badge.test.tsx`
- `src/features/documentos/components/documents-table.test.tsx`
- `src/features/documentos/components/documents-section.test.tsx`

**Test cases (DocumentTypeBadge)**:
- Renders correct color class for each of 4 types
- Renders capitalized label

**Test cases (DocumentsTable)**:
- Renders empty state when `documents` is `[]`
- Renders one row per document
- Displays property address when `property.address` is present
- Displays `—` when both `property` and `contract` are null
- Download button is present for each row
- Delete button is present for each row

**Test cases (DocumentsSection)**:
- Renders "Subir documento" button
- Clicking button sets dialog open
- Passes documents to DocumentsTable
- Shows loading state when `isLoading` is true

**Acceptance**: All 12 component tests pass. `DocumentosPage` renders `<DocumentsSection />` without errors.

---

## [x] T-D8 — Wire upload/delete actions, verify RLS end-to-end

**No new files** — integration wiring and manual verification checklist.

### Wiring checklist

- [ ] `useDocumentUrl` signed URL is generated on Download click (not on row render)
- [ ] Delete confirmation: add `window.confirm` or Shadcn `AlertDialog` before `useDeleteDocument.mutate`
- [ ] `isPending` state from `useDeleteDocument` disables the Delete button during mutation
- [ ] `isPending` state from `useUploadDocument` disables the Submit button during mutation

### RLS verification (manual, local Supabase)

- [ ] As admin: can upload, list, download (signed URL works), delete
- [ ] As non-admin authenticated user: SELECT returns 0 rows; INSERT returns 403
- [ ] Storage path `{org_id}/{uuid}-{name}` is rejected if `org_id` segment does not match JWT
- [ ] 10 MB file upload is accepted; 11 MB file upload returns storage error

### Acceptance

- Upload → document appears in list immediately (query invalidated)
- Delete → document disappears from list immediately (query invalidated)
- Download opens file in new tab (signed URL)
- All RLS checks above pass manually

---

## Task Dependency Order

```
T-D1 (migration) → T-D2 (types regen) → T-D3, T-D4, T-D5 (hooks, parallelizable)
                                       → T-D6 (dialog, needs hooks)
                                       → T-D7 (UI, needs hooks + dialog)
                                       → T-D8 (wiring + RLS verify, last)
```

T-D3, T-D4, T-D5 can be implemented in parallel after T-D2. T-D6 depends on T-D4 (upload
hook). T-D7 depends on T-D3, T-D5, T-D6. T-D8 is the final integration gate.
