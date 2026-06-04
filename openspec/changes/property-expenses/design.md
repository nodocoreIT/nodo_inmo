# Design: property-expenses

Technical design for the **Gasto de propiedad** entity (leg 1 of the rendiciones
roadmap). This is the source of truth for `tasks` and `apply`. SQL here is written to run
against the shared Supabase project via the Supabase MCP (`execute_sql` to iterate, then
committed as a migration with `supabase db pull`). Frontend follows the existing
`src/features/<feature>/{components,hooks,lib,__tests__}` convention.

It builds **only** the entity, its private receipt storage, and the "Registrar gasto"
UI. It exposes a documented, queryable seam for the settlement flow to consume
`charged_to_owner = true` rows as deductions — it does **not** build the deduction math,
the rendición UI, the PDF, or the history (legs 2–4).

## 1. Architecture decisions (ADR-style)

### ADR-1 — Dedicated `nodo_inmo.property_expenses` table, not a `cash_movements` row

- **Decision:** A new business table `nodo_inmo.property_expenses`.
- **Rationale:** `cash_movements` is the agency's money ledger; balance is derived as
  `sum(income) − sum(expense)`. An owner-charged expense (`charged_to_owner = true`)
  never touches agency cash — it is borne by the owner as a settlement deduction. Forcing
  it into the ledger corrupts the derived balance. The expense also needs `property_id`,
  `type`, `charged_to_owner`, and `receipt_path`, none of which belong on a generic
  movement (they would be perpetually-nullable noise).
- **Rejected:** A `cash_movements` row with `source = 'property_expense'`. Rejected — it
  either corrupts the balance or requires balance math to special-case a source, leaking
  expense semantics into the ledger.
- **Consequence:** When `charged_to_owner = false` expenses eventually need to hit the
  ledger as a real agency outflow, that is a deliberate later posting (mirroring
  `post_payment_to_caja`), out of scope here. The table shape does not preclude it.

### ADR-2 — RLS Template B (admin-only), same tier as caja/owner_settlements

- **Decision:** Template B per `CONVENTIONS.md` — org-scoped AND `app_metadata.role = 'admin'`.
- **Rationale:** Expenses carry receipt photos (facturas with tax IDs) and directly
  reduce owner payouts — the same trust tier as `owner_settlements` and `cash_movements`.
  Keeping the deduction source under the same gate as its consumer means an agent can
  never see or alter what an owner is charged.
- **Rejected:** Template A (staff-shared). Rejected as the default; the
  agent-registers-expense workflow is an open question (see §9), reversible toward
  openness later. Defaulting to the stricter B is the safe choice.

### ADR-3 — Private Storage bucket + path-encoded `org_id`, signed-URL reads (HEADLINE RISK)

- **Decision:** A single private bucket `property-receipts` (`public = false`). Receipt
  objects are keyed `{org_id}/{property_id}/{expense_id-or-uuid}-{filename}`. Access is
  gated by `storage.objects` RLS policies that read `org_id` from the **first path
  segment** and require `role = 'admin'`. The app **never** builds public URLs — it reads
  via `createSignedUrl` (short TTL).
- **Rationale:** `storage.objects` has no `org_id` column, so tenant scoping must come
  from the object key. Encoding `org_id` as the leading folder lets the policy compare
  `(storage.foldername(name))[1]` against the JWT `org_id`. A public bucket would expose
  every factura via a guessable URL with no auth — the exact trap the Supabase security
  checklist warns about.
- **Rejected:** Public bucket + obscure filenames (security by obscurity — rejected).
  Storing the photo as a `bytea` column (bloats the table, breaks streaming, no CDN —
  rejected).
- **Consequence:** Upsert (photo replacement) needs INSERT + SELECT + UPDATE policies
  together; granting only INSERT makes replacement silently fail. All three are written.
  This is the single most security-sensitive part of the change — verified by tests where
  expressible and by a manual cross-tenant signed-URL check.

### ADR-4 — `charged_to_owner boolean NOT NULL` from day one, no default

- **Decision:** Required boolean, **no column default** — the form forces an explicit
  choice.
- **Rationale:** The flag is load-bearing for real money. A default silently biases every
  expense one way; an omitted value should be a write error, not a guess. Carrying it now
  avoids a backfill migration over real receipts later.

### ADR-5 — Co-locate under `src/features/property-expenses/`, entry point on the property row

- **Decision:** New feature folder `src/features/property-expenses/`, NOT nested inside
  `properties/`. The "Registrar gasto" action is added as a row action in
  `properties-list.tsx` (alongside Edit/Delete), opening the expense dialog with
  `propertyId` pre-bound.
- **Rationale:** Expenses are their own bounded entity with their own table, hooks, RLS
  tier (admin-only vs properties' staff-shared), and lifecycle. Nesting them under
  `properties/` would mix two RLS tiers and two domains in one folder. A sibling feature
  matches how `caja/` sits beside `properties/` despite consuming property data. The
  property row is the natural birth point per the proposal, so the entry point lives
  there while the implementation lives in its own feature.
- **Rejected:** `src/features/properties/components/expense-form-dialog.tsx`. Rejected —
  couples an admin-only money entity to the staff-shared properties feature.

### ADR-6 — Settlement consumption via a `security_invoker` view, not denormalized columns

- **Decision:** Expose deduction-eligible expenses through a read-only view
  `nodo_inmo.owner_chargeable_expenses` created `WITH (security_invoker = true)`, joining
  `property_expenses → properties` to surface `owner_id`. No `owner_id` column is stored
  on the expense.
- **Rationale:** The owner is reachable through `property.owner_id`; storing it on the
  expense would denormalize and risk drift if a property's owner changes. A view keeps a
  single source of truth and gives the consuming change a stable, named contract
  (`owner_id`, `expense_date`, `amount`, `currency`) to sum as deductions. `security_invoker`
  ensures the view does NOT bypass the underlying Template B RLS (the Supabase view trap).
- **Rejected:** A materialized snapshot, or per-settlement linkage now. Rejected — the
  owner-snapshot rule (as-of-expense vs as-of-settlement) is the consuming change's
  decision (proposal open question). This change only commits to "queryable and
  access-gated identically to the settlement."

## 2. Database — `nodo_inmo.property_expenses`

Schema namespace: `nodo_inmo` (consistent with every business table). Reuses
`nodo_inmo.set_updated_at()` (defined in the properties migration). No new extensions.

```sql
create table nodo_inmo.property_expenses (
  id               uuid          primary key default gen_random_uuid(),
  org_id           uuid          not null
                                 references shared.organizations(id)
                                 on delete cascade,
  property_id      uuid          not null
                                 references nodo_inmo.properties(id)
                                 on delete restrict,
  type             text          not null
                                 check (type in ('arreglo', 'compra_accesorio')),
  amount           numeric(15,2) not null check (amount >= 0),
  currency         text          not null default 'ARS'
                                 check (currency in ('ARS', 'USD')),
  expense_date     date          not null default current_date,
  description      text          not null,
  receipt_path     text,         -- storage object key in `property-receipts`; nullable
  charged_to_owner boolean       not null,   -- load-bearing; NO default (ADR-4)
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default clock_timestamp()
);
```

Design notes:

- `on delete restrict` on `property_id` — an expense (a real receipt, possibly a
  deduction) must not vanish because a property row is removed; deletion is blocked while
  expenses exist. (Contrast with `org_id` cascade, which only fires on full-tenant
  teardown.)
- `amount numeric(15,2) check (amount >= 0)` — mirrors `cash_movements`.
- `currency` default `'ARS'`, `check (currency in ('ARS','USD'))` — mirrors the
  caja/payments convention so the future settlement flow can convert faithfully.
- `description not null` — an expense without a description is not auditable; the form
  requires it.
- `receipt_path` nullable — a receipt photo is strongly encouraged but the row can exist
  before/without an upload (e.g. cash with no factura). The UI nudges toward attaching one.
- `charged_to_owner` has **no default** intentionally (ADR-4).

### Indexes

```sql
create index property_expenses_org_id_idx       on nodo_inmo.property_expenses (org_id);
create index property_expenses_property_id_idx  on nodo_inmo.property_expenses (property_id);
-- Settlement consumption: owner-charged rows scanned by period. Partial index keeps it
-- small (only the rows the rendición cares about) and leading-column ordered by date.
create index property_expenses_chargeable_idx
  on nodo_inmo.property_expenses (org_id, expense_date)
  where charged_to_owner = true;
```

Rationale: `org_id` and `property_id` for tenant/property listing; the partial index on
`(org_id, expense_date) where charged_to_owner` directly serves the deduction query
(per-owner is reached through the property join in the view, but the period filter and
the `charged_to_owner` predicate are the selective ones).

### updated_at trigger

```sql
create trigger set_updated_at
  before update on nodo_inmo.property_expenses
  for each row
  execute function nodo_inmo.set_updated_at();
```

## 3. RLS — Template B (admin-only), mirrored from the caja migration

Uses the InitPlan-friendly form `org_id = ((select auth.jwt()) -> 'app_metadata' ->>
'org_id')::uuid` exactly as `create_caja.sql`. UPDATE has both `USING` and `WITH CHECK`
so `org_id` cannot be reassigned across tenants.

```sql
alter table nodo_inmo.property_expenses enable row level security;

create policy "admin_select" on nodo_inmo.property_expenses
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.property_expenses
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.property_expenses
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.property_expenses
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
```

Table privileges: the foundation migration's `alter default privileges in schema
nodo_inmo grant ... to authenticated` already makes the table reachable; RLS gates it to
admins. No extra `grant` needed (matches the note at the foot of `create_caja.sql`).

## 4. Storage — private bucket `property-receipts` (HEADLINE RISK)

### 4.1 Bucket

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-receipts', 'property-receipts', false,
  10485760,  -- 10 MiB cap per receipt
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;
```

`public = false` is the non-negotiable line. Also declared in `config.toml` for local
dev so `supabase start` provisions it:

```toml
[storage.buckets.property-receipts]
public = false
file_size_limit = "10MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
```

### 4.2 Path convention

```
property-receipts/{org_id}/{property_id}/{uuid}-{sanitized_filename}
```

The leading `{org_id}` segment is what the RLS policies key on (`storage.objects` has no
`org_id` column). `{property_id}` groups receipts per property for browsability; the
`{uuid}-` prefix prevents collisions and makes the key unguessable.

### 4.3 `storage.objects` policies — INSERT + SELECT + UPDATE + DELETE (admin-only, org-scoped)

INSERT + SELECT + UPDATE are required **together** for upsert (Supabase checklist:
INSERT-only makes replacement silently fail). DELETE lets an admin remove a wrong upload.
Each policy scopes the bucket AND the org (first path folder) AND `role = 'admin'`.

```sql
create policy "receipts_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'property-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "receipts_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "receipts_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'property-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    bucket_id = 'property-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "receipts_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'property-receipts'
    and (storage.foldername(name))[1]
        = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
```

Notes:
- `(storage.foldername(name))[1]` returns the first folder of the object key — `org_id`.
  Compared as **text** against the JWT `org_id` claim (no `::uuid` cast needed; both are
  text here, and casting a malformed segment would error rather than deny).
- `storage.objects` already has RLS enabled by Supabase; we only add policies.

### 4.4 Client upload + retrieval

- **Upload** (`useUploadReceipt`): build the key as
  `${orgId}/${propertyId}/${crypto.randomUUID()}-${sanitize(file.name)}`, call
  `supabase.storage.from('property-receipts').upload(key, file, { upsert: true })`,
  return the `path`. The form stores that path in `receipt_path` on insert.
- **Retrieval** (`useReceiptUrl`): call
  `supabase.storage.from('property-receipts').createSignedUrl(receipt_path, 60)` on
  demand (e.g. when opening/viewing). **Never** `getPublicUrl` — the bucket is private and
  a public URL would 400/expose nothing useful while signalling the wrong intent. Signed
  URLs are short-lived (60 s) and minted only for admins (RLS gates the underlying read).

## 5. Settlement consumption seam (exposed, not wired)

```sql
create view nodo_inmo.owner_chargeable_expenses
  with (security_invoker = true) as
select
  e.id            as expense_id,
  e.org_id,
  p.owner_id,
  e.property_id,
  e.amount,
  e.currency,
  e.expense_date,
  e.type,
  e.description
from nodo_inmo.property_expenses e
join nodo_inmo.properties p on p.id = e.property_id
where e.charged_to_owner = true;
```

- `security_invoker = true` (Postgres 15+) — the view runs with the caller's privileges,
  so the underlying Template B RLS on `property_expenses` still applies. Without it, the
  view would bypass RLS (the Supabase view trap) and leak cross-tenant rows.
- The consuming change queries:
  `... from nodo_inmo.owner_chargeable_expenses where owner_id = $1 and expense_date between $2 and $3`
  and sums `amount` per `currency`. The FX/owner-snapshot rules are **its** decision; this
  view is the stable contract.
- Rows where `p.owner_id is null` naturally fall out of the join — an expense on an
  owner-less property cannot be charged to an owner.

This change does **not** alter `owner_settlements` and does **not** compute deductions.

## 6. Frontend — `src/features/property-expenses/`

```
src/features/property-expenses/
  hooks/
    use-property-expenses.ts        # list query (per property), PROPERTY_EXPENSES_QUERY_KEY
    use-create-expense.ts           # mutation: insert row (+ org_id from useAuth)
    use-upload-receipt.ts           # storage upload → returns object key
    use-receipt-url.ts              # createSignedUrl on demand
  components/
    expense-form-dialog.tsx         # react-hook-form + zod; photo file input
    register-expense-button.tsx     # row action that opens the dialog with propertyId
  lib/
    expense-labels.ts               # TYPE_LABELS (arreglo/compra_accesorio), formatAmount
  __tests__/
    create-expense.test.tsx
    use-create-expense.test.ts      # (optional) mutation shape
```

Entry point: `properties-list.tsx` gains a third row action ("Registrar gasto") in
`RowActions`, gated on `role === 'admin'` from `useAuth` (UI mirror of the RLS gate, not a
substitute). It sets `expenseProperty` state and renders `<ExpenseFormDialog>` with the
property bound — same pattern as the existing edit-dialog wiring.

### Hooks (match existing patterns exactly)

`use-create-expense.ts` mirrors `use-create-cash-movement.ts`:

```ts
type PropertyExpenseInsert =
  Database["nodo_inmo"]["Tables"]["property_expenses"]["Insert"];
export type CreateExpenseInput = Omit<PropertyExpenseInsert, "org_id">;

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("property_expenses")
        .insert({ ...input, org_id: orgId });
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PROPERTY_EXPENSES_QUERY_KEY }),
  });
}
```

`use-upload-receipt.ts` is a separate mutation so the form can: (1) upload the file →
get the key, (2) insert the row with `receipt_path = key`. Sequencing (upload-then-insert)
keeps the row honest about whether the photo actually landed; if upload fails, no row is
created. To avoid orphaned objects if the insert fails after a successful upload, the
form deletes the just-uploaded object on insert error (best-effort).

### Form (react-hook-form + zod — verified the project pattern)

Mirrors `movement-form-dialog.tsx`: `useForm` + `zodResolver`, shadcn `Form/FormField`,
`Select` for `type`, `Input` for amount/date/description, a native file `<input>` for the
photo, and a `charged_to_owner` control with **no default** (required radio/switch — the
user must pick). Zod schema:

```ts
const schema = z.object({
  type: z.enum(["arreglo", "compra_accesorio"]),
  amount: z.string().min(1, "Monto requerido"),
  currency: z.enum(["ARS", "USD"]),
  expense_date: z.string().min(1, "Fecha requerida"),
  description: z.string().min(1, "Descripción requerida"),
  charged_to_owner: z.boolean({ required_error: "Indicá si se le cobra al propietario" }),
  receipt: z.instanceof(File).optional(),
});
```

`amount` is captured as string and `Number(...)`-coerced on submit (matches
`movement-form-dialog.tsx`). Radix `Select` is mocked with a native `<select>` in tests
(jsdom Pointer Events limitation), exactly as `create-property.test.tsx` documents.

## 7. Types — `database.ts` regeneration

`src/shared/types/database.ts` is generated. After the migration is committed, regenerate
with the project's existing command (`supabase gen types typescript --local` → write to
`src/shared/types/database.ts`). This adds `property_expenses` Row/Insert/Update and the
`owner_chargeable_expenses` view to `Database["nodo_inmo"]`. Hooks import these generated
types (`...["Tables"]["property_expenses"]["Insert"]`) — no hand-written types.

## 8. Testing strategy (Strict TDD active — RED first)

### pgTAP — `supabase/tests/130_property_expenses.test.sql`

Follows the `120_caja.test.sql` style (`begin; select plan(N); ... select * from
finish(); rollback;`), seeding one org + admin + agent + a property. RED before the
migration, GREEN after.

Structure / constraints:
- `has_table('nodo_inmo','property_expenses', ...)`, `col_is_pk(... 'id' ...)`.
- `col_not_null` for `org_id`, `property_id`, `type`, `amount`, `description`,
  `charged_to_owner`.
- `col_has_default` is **false** for `charged_to_owner` (assert via `col_default_is(...,
  null, ...)` / `col_hasnt_default`) — proves ADR-4.
- `col_default_is(... 'currency' ... 'ARS' ...)`, `col_default_is(... 'expense_date' ...
  current_date ...)`.
- `throws_ok` for invalid `type`, invalid `currency`, negative `amount`, and a missing
  `charged_to_owner` (NOT NULL violation).
- `col_is_fk` for `property_id`; `has_index('nodo_inmo','property_expenses',
  'property_expenses_chargeable_idx', ...)`.
- `lives_ok` for a valid insert; `updated_at` advances on UPDATE (the `do $$ ... $$`
  pattern).

RLS — Template B:
- `set local role authenticated` + agent claims → agent sees 0 rows and INSERT is blocked
  (`throws_ok`).
- admin claims → admin sees rows, can INSERT, can UPDATE; `throws_ok` on reassigning
  `org_id` (WITH CHECK).

View:
- After inserting one `charged_to_owner = true` and one `= false` row, admin sees exactly
  the `true` row in `owner_chargeable_expenses` with the correct `owner_id` (from the
  property join); agent sees 0 (security_invoker preserves Template B).

Storage policies (where expressible in pgTAP): assert policy existence and bucket
privacy:
- `select is((select public from storage.buckets where id = 'property-receipts'), false,
  ...)`.
- `policies_are('storage','objects', ...)` / `has_policy` style checks for the four
  `receipts_admin_*` policies. Note: a full signed-URL cross-tenant read requires the
  Storage API (HTTP), which pgTAP cannot drive — that is the manual check below.

### Manual verification (cannot be pure pgTAP)

1. `supabase start`; as admin of org A, register an expense with a photo → object lands at
   `A/{property}/...`.
2. As admin of org B, attempt `createSignedUrl` on org A's key → denied (RLS).
3. Confirm the bucket is not public: hitting the public URL returns nothing usable.

### vitest — `src/features/property-expenses/__tests__/`

Mirrors `create-property.test.tsx` (mock `supabase`, `useAuth`, Radix `Select`, and the
mutation hooks):
- `expense-form-dialog` renders type/amount/date/description/photo and the
  `charged_to_owner` control.
- blocks submit when description empty / when `charged_to_owner` not chosen.
- on valid submit calls upload (when a file is attached) then `mutateAsync` with
  `org_id` from auth, `receipt_path` from the upload, and the entered values.
- calls `onSuccess` after a successful insert.
- (hook test, optional) `useCreateExpense` throws when `orgId` is absent.

Strict-TDD feasibility: every layer (table shape, RLS, view, form, hooks) has an
assertion that fails before implementation, so tests can be written RED first.

## 9. Risks & open questions (carried from proposal)

1. **Receipt photo exposure (HEADLINE).** Mitigated by: private bucket, org+admin-scoped
   `storage.objects` policies keyed on the path's first folder, signed-URL reads,
   INSERT+SELECT+UPDATE for upsert. Must be **verified** (manual cross-tenant check), not
   assumed.
2. **`charged_to_owner` semantics drift.** No default + NOT NULL + tested. The view only
   surfaces `true` rows; absorbed (`false`) expenses never reach the deduction seam.
3. **Owner derivation via property.** The view resolves `owner_id` live through the
   property join. If a property's owner changes between expense and settlement, "who is
   charged" is ambiguous — the snapshot rule is the **consuming change's** decision
   (open). This change stores `property_id` + `expense_date`, which is enough to support
   either rule later.
4. **Template B vs agent workflow (open).** Admin-only may be too strict if field agents
   hold the receipts. Reversible to Template A + an admin-only gate on `charged_to_owner`.
   Defaulting to B per proposal.
5. **Currency/FX on deductions.** The entity stores `currency` faithfully; cross-currency
   summing is the settlement flow's problem.
6. **Orphaned storage objects.** Upload-then-insert can leave an object if the insert
   fails; mitigated by best-effort delete on insert error. A periodic reconciliation
   (objects with no matching `receipt_path`) is a possible later hardening, out of scope.

## 10. Migration commit flow

1. Iterate schema with MCP `execute_sql` (no migration-history churn) — table, indexes,
   trigger, RLS, bucket, storage policies, view.
2. Run `supabase db advisors` / MCP `get_advisors`; fix findings (expect a check on the
   view's `security_invoker` and on storage policies).
3. `supabase migration new create_property_expenses` is **not** used directly for schema;
   instead `supabase db pull create_property_expenses --local --yes` generates the
   migration from the iterated DB (matches `create_caja` provenance). Expected filename
   shape: `supabase/migrations/<timestamp>_create_property_expenses.sql`.
4. `supabase migration list --local` to verify.
5. Regenerate `src/shared/types/database.ts`.
6. Add the pgTAP test as `supabase/tests/130_property_expenses.test.sql`.

## 11. Security checklist (run before committing)

- [ ] RLS enabled on `nodo_inmo.property_expenses`; four Template B policies present.
- [ ] Every UPDATE/ALL policy has both `USING` and `WITH CHECK`.
- [ ] No policy reads `user_metadata` (all use `app_metadata`).
- [ ] Bucket `property-receipts` is `public = false`.
- [ ] `storage.objects` has INSERT + SELECT + UPDATE + DELETE policies, each scoped by
      `bucket_id`, first-folder `org_id`, and `role = 'admin'`.
- [ ] View `owner_chargeable_expenses` is `security_invoker = true`.
- [ ] `supabase db advisors` runs clean.
- [ ] Manual cross-tenant signed-URL read denied; public URL exposes nothing.
