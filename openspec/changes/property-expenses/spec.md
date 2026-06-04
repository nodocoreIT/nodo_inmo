# Spec: property-expenses

Requirements for the property expense entity (leg 1 of the rendiciones roadmap).
Each requirement is verifiable. Scenarios use Given/When/Then. "MUST" is normative.

Test targets: **pgTAP** for all DB requirements; **vitest** for UI/hook requirements.

---

## Capability: Table existence and shape

### R1 — Table exists in the correct schema
`nodo_inmo.property_expenses` MUST exist as a regular table in the `nodo_inmo` schema.

- **Scenario: table present**
  - Given the property-expenses migration has been applied
  - When `information_schema.tables` is queried for `table_schema = 'nodo_inmo'` and
    `table_name = 'property_expenses'`
  - Then exactly one row is returned

### R2 — Required columns and types
The table MUST have the following columns with the specified types and nullability:

| Column             | Type                       | Nullable | Constraint           |
|--------------------|----------------------------|----------|----------------------|
| `id`               | `uuid`                     | NOT NULL | PRIMARY KEY, default gen_random_uuid() |
| `org_id`           | `uuid`                     | NOT NULL | FK → shared.organizations |
| `property_id`      | `uuid`                     | NOT NULL | FK → nodo_inmo.properties |
| `type`             | `text`                     | NOT NULL | CHECK IN ('arreglo','compra_accesorio') |
| `amount`           | `numeric`                  | NOT NULL | CHECK > 0            |
| `currency`         | `text`                     | NOT NULL | CHECK IN ('ARS','USD') |
| `expense_date`     | `date`                     | NOT NULL |                      |
| `description`      | `text`                     | NOT NULL |                      |
| `receipt_path`     | `text`                     | NULL     |                      |
| `charged_to_owner` | `boolean`                  | NOT NULL |                      |
| `created_at`       | `timestamptz`              | NOT NULL | default now()        |
| `updated_at`       | `timestamptz`              | NOT NULL | default now()        |

- **Scenario: column presence and types (pgTAP)**
  - Given the migration has been applied
  - When `information_schema.columns` is queried for each required column on
    `nodo_inmo.property_expenses`
  - Then each column exists with the specified data type and nullability

### R3 — `charged_to_owner` has no default
`charged_to_owner` MUST be `NOT NULL` with no column-level default, forcing every INSERT
to supply an explicit value.

- **Scenario: insert without charged_to_owner is rejected**
  - Given the table exists
  - When an INSERT omits `charged_to_owner`
  - Then Postgres rejects the statement with a NOT NULL violation

### R4 — `amount` must be positive
The table MUST enforce a CHECK constraint that `amount > 0`.

- **Scenario: zero amount rejected**
  - Given a well-formed expense row
  - When `amount` is set to `0`
  - Then the INSERT is rejected by the check constraint
- **Scenario: negative amount rejected**
  - Given a well-formed expense row
  - When `amount` is set to `-1`
  - Then the INSERT is rejected by the check constraint

### R5 — `type` is limited to known values
The table MUST enforce a CHECK constraint limiting `type` to `'arreglo'` and
`'compra_accesorio'`.

- **Scenario: invalid type rejected**
  - Given a well-formed expense row
  - When `type` is set to `'otro'`
  - Then the INSERT is rejected by the check constraint

### R6 — `currency` is limited to known values
The table MUST enforce a CHECK constraint limiting `currency` to `'ARS'` and `'USD'`.

- **Scenario: invalid currency rejected**
  - Given a well-formed expense row
  - When `currency` is set to `'EUR'`
  - Then the INSERT is rejected by the check constraint

### R7 — `updated_at` is auto-maintained
The `updated_at` column MUST be updated automatically on every UPDATE via the project's
`set_updated_at()` trigger — no caller action required.

- **Scenario: trigger fires on update (pgTAP)**
  - Given an existing expense row inserted at time T
  - When the row is updated (e.g. description changed) at time T+1
  - Then `updated_at` reflects T+1 and is greater than `created_at`

---

## Capability: Row Level Security — Template B (admin-only)

### R8 — RLS enabled
`nodo_inmo.property_expenses` MUST have row-level security enabled (`relrowsecurity = true`).

- **Scenario: RLS on (pgTAP)**
  - Given the migration has been applied
  - When `pg_class.relrowsecurity` is checked for `property_expenses`
  - Then it is `true`

### R9 — Admin can read own-org expenses
A user with `app_metadata.role = 'admin'` and `app_metadata.org_id = A` MUST be able to
SELECT rows where `org_id = A`.

- **Scenario: admin reads own org (pgTAP)**
  - Given an expense row for org A
  - And a JWT with `app_metadata = { "org_id": "<A>", "role": "admin" }`
  - When a SELECT is issued under that JWT
  - Then the row is returned

### R10 — Admin can insert into own org
A user with `app_metadata.role = 'admin'` and `app_metadata.org_id = A` MUST be able to
INSERT a row with `org_id = A`.

- **Scenario: admin insert succeeds (pgTAP)**
  - Given a JWT with `app_metadata = { "org_id": "<A>", "role": "admin" }`
  - When an INSERT with `org_id = A` is executed under that JWT
  - Then the row is committed

### R11 — Non-admin (agent) is blocked from all operations
A user with `app_metadata.role = 'agent'` MUST receive zero rows on SELECT and a policy
violation on INSERT/UPDATE/DELETE against `property_expenses`.

- **Scenario: agent SELECT returns zero rows (pgTAP)**
  - Given expense rows exist for org A
  - And a JWT with `app_metadata = { "org_id": "<A>", "role": "agent" }`
  - When a SELECT is issued
  - Then zero rows are returned (not an error — RLS silently filters)
- **Scenario: agent INSERT is rejected (pgTAP)**
  - Given a JWT with `app_metadata = { "org_id": "<A>", "role": "agent" }`
  - When an INSERT is attempted
  - Then it is rejected by the RLS policy

### R12 — Cross-org read is blocked
An admin of org A MUST NOT be able to read expenses belonging to org B.

- **Scenario: cross-org SELECT blocked (pgTAP)**
  - Given expense rows for org A and org B
  - And a JWT scoped to org A with role `admin`
  - When a SELECT is issued
  - Then only org A rows are returned; org B rows are invisible

### R13 — Org_id cannot be reassigned
The UPDATE policy MUST include both `USING` and `WITH CHECK` so that a row's `org_id`
cannot be changed to a different org.

- **Scenario: org reassignment blocked (pgTAP)**
  - Given an admin of org A owns an expense row
  - When the admin attempts to set `org_id = B` on that row
  - Then the update is rejected by the `WITH CHECK` clause

### R14 — Unauthenticated access is blocked
The `anon` role MUST receive zero rows on SELECT and a rejection on INSERT.

- **Scenario: anon blocked (pgTAP)**
  - Given expense rows exist
  - When a SELECT is issued without authentication (anon role)
  - Then zero rows are returned

---

## Capability: Storage — receipt photos

### R15 — Private bucket exists
A Supabase Storage bucket named `property-expense-receipts` MUST exist and MUST be
configured as **private** (`public = false`).

- **Scenario: bucket is private**
  - Given the migration has been applied
  - When `storage.buckets` is queried for `name = 'property-expense-receipts'`
  - Then a row exists with `public = false`

### R16 — Admin can upload a receipt (INSERT + SELECT + UPDATE)
A user with `role = 'admin'` in org A MUST be able to upload a receipt to the bucket
path `<org_id>/<expense_id>/<filename>`. The storage policy MUST grant INSERT, SELECT,
and UPDATE on `storage.objects` for this path so that re-uploading (upsert) works.

- **Scenario: admin upload succeeds**
  - Given a JWT with `app_metadata = { "org_id": "<A>", "role": "admin" }`
  - When the client calls `supabase.storage.from('property-expense-receipts').upload(...)`
    with a path prefixed by `<A>/`
  - Then the file is stored and a subsequent `.createSignedUrl(...)` returns a valid URL
- **Scenario: admin re-upload (upsert) succeeds**
  - Given the admin has already uploaded a file at a path
  - When the admin uploads again to the same path with `{ upsert: true }`
  - Then the file is replaced without error (INSERT + SELECT + UPDATE all in effect)

### R17 — Non-admin cannot read or write receipts
A user with `role = 'agent'` in any org MUST NOT be able to download or upload receipts.

- **Scenario: agent download blocked**
  - Given a receipt exists in the bucket
  - And a JWT with `app_metadata = { "role": "agent", "org_id": "<A>" }`
  - When the agent calls `createSignedUrl` or attempts a direct download
  - Then the request is denied by the storage policy
- **Scenario: agent upload blocked**
  - Given a JWT with `app_metadata = { "role": "agent", "org_id": "<A>" }`
  - When the agent calls `.upload(...)` on the bucket
  - Then the request is denied

### R18 — Cross-org receipt access blocked
An admin of org A MUST NOT be able to read or write receipts belonging to org B.

- **Scenario: cross-org download blocked**
  - Given a receipt stored at path `<B>/<expense_id>/receipt.jpg`
  - And a JWT scoped to org A with role `admin`
  - When the admin attempts to download or create a signed URL for that path
  - Then the request is denied by the storage policy

### R19 — Receipts are never served via public URL
The bucket MUST NOT be public. Accessing a receipt MUST require a **signed URL** generated
server-side or via authenticated client. No receipt MUST be reachable at a predictable,
unauthenticated URL.

- **Scenario: public URL returns no file**
  - Given a receipt uploaded by an admin
  - When the public URL pattern (`/storage/v1/object/public/property-expense-receipts/...`)
    is requested without authentication
  - Then the response is 400 or 404 (bucket is private, not accessible without auth)

### R20 — `receipt_path` stores the storage key, not a URL
The `receipt_path` column MUST contain the storage object path/key (e.g.
`<org_id>/<expense_id>/receipt.jpg`), not a pre-signed or public URL. Signed URLs are
generated at read time.

- **Scenario: path format enforced by convention**
  - Given an expense is created with a receipt
  - When `receipt_path` is read from the database
  - Then its value does not start with `https://` or `http://`
  - (Enforced by application code, not a DB constraint — verified in the create hook test)

---

## Capability: Create expense from property card (UI)

### R21 — "Registrar gasto" action is present on the property card
A "Registrar gasto" action (button or menu item) MUST be visible on the property detail
card for users with `role = 'admin'`. It MUST NOT be visible for users with `role = 'agent'`.

- **Scenario: admin sees action (vitest/RTL)**
  - Given a property card rendered with `role = 'admin'`
  - Then a "Registrar gasto" element is present in the document
- **Scenario: agent does not see action (vitest/RTL)**
  - Given a property card rendered with `role = 'agent'`
  - Then no "Registrar gasto" element is present

### R22 — Expense form collects all required fields
The "Registrar gasto" form MUST collect: type, amount, currency, expense_date,
description, charged_to_owner (checkbox, no default), and an optional receipt photo upload.

- **Scenario: form renders all fields (vitest/RTL)**
  - Given the expense form is rendered
  - Then the following controls are present: type selector, amount input, currency
    selector, date picker, description textarea, `charged_to_owner` checkbox, and file
    input for receipt
  - And the `charged_to_owner` checkbox MUST NOT be pre-checked

### R23 — Form validation blocks submission with invalid data
The form MUST prevent submission when: amount is missing or ≤ 0; type is not selected;
expense_date is missing; description is empty.

- **Scenario: submit with missing amount shows error (vitest)**
  - Given the expense form is rendered
  - When the user submits without entering an amount
  - Then a validation error is shown and no network request is made
- **Scenario: submit with zero amount shows error (vitest)**
  - Given the expense form is rendered
  - When the user enters `0` as amount and submits
  - Then a validation error is shown
- **Scenario: submit with all valid fields succeeds (vitest)**
  - Given all required fields are filled with valid values
  - And `charged_to_owner` is explicitly set (either true or false)
  - When the user submits
  - Then `supabase.from('property_expenses').insert(...)` is called with the correct payload
  - And `receipt_path` in the payload is the storage key (not a URL)

### R24 — Receipt photo upload happens before the row is inserted
The create flow MUST upload the photo to Storage first, obtain the storage path, then
insert the expense row with that path. If the upload fails, no row is inserted.

- **Scenario: upload-then-insert ordering (vitest — unit test on the create hook)**
  - Given the user has selected a file
  - When `useCreateExpense` is called
  - Then `supabase.storage.upload` is called before `supabase.from(...).insert`
  - And if `storage.upload` rejects, `insert` is never called

### R25 — Successful creation shows feedback and closes form
After a successful INSERT the form MUST close and a success notification MUST be shown.
On failure the form remains open and an error message is displayed.

- **Scenario: success feedback (vitest/RTL)**
  - Given the create mutation resolves successfully
  - When the form is submitted
  - Then a success toast/notification appears
  - And the form is no longer visible

---

## Capability: `cash_movements` ledger isolation

### R26 — Creating a property expense does NOT insert into `cash_movements`
Registering an expense — regardless of the `charged_to_owner` value — MUST NOT create or
modify any row in `nodo_inmo.cash_movements`.

- **Scenario: ledger untouched (pgTAP)**
  - Given `cash_movements` has N rows for org A
  - When an expense row is inserted for org A (both `charged_to_owner = true` and `false`
    variants)
  - Then `cash_movements` still has exactly N rows for org A
- **Scenario: ledger untouched (vitest — integration style)**
  - Given the create expense mutation completes successfully
  - When the test inspects all mocked Supabase calls
  - Then no call to `from('cash_movements')` was made

---

## Capability: Deduction query contract

### R27 — `charged_to_owner = true` expenses are queryable per owner and date range
The system MUST allow the settlement flow to query all `charged_to_owner = true` expenses
for a given owner (identified via the property's owner contact) within a date range, and
to receive the result as an ordered list of deduction lines.

- **Scenario: deduction query returns correct rows (pgTAP)**
  - Given properties P1 and P2 belong to owner contact C in org A
  - And four expenses exist: E1 (`charged_to_owner = true`, P1, within period),
    E2 (`charged_to_owner = false`, P1, within period),
    E3 (`charged_to_owner = true`, P2, within period),
    E4 (`charged_to_owner = true`, P1, outside period)
  - When the deduction query runs for owner C, org A, and the period
  - Then only E1 and E3 are returned
  - And the result includes: `id`, `property_id`, `type`, `amount`, `currency`,
    `expense_date`, `description`

- **Scenario: no deductions returns empty set (pgTAP)**
  - Given no `charged_to_owner = true` expenses exist for the owner in the period
  - When the deduction query runs
  - Then an empty result set is returned

### R28 — Owner is derived via `property_id → properties.owner_contact_id`
The deduction query MUST join through `property_id` to reach the owning contact. This
join path MUST be the documented contract for the consuming settlement flow.

- **Scenario: owner derivation join is correct (pgTAP)**
  - Given an expense for property P, where P has `owner_contact_id = C`
  - When the deduction query filters by contact C
  - Then the expense is included in the result

---

## Capability: Advisors and security posture

### R29 — Advisors report no security errors
After applying the migration, `supabase db advisors` (or MCP `get_advisors`) MUST report
zero security errors for `nodo_inmo.property_expenses` and the receipt bucket's storage
policies.

- **Scenario: advisors clean**
  - Given the migration is applied locally
  - When `supabase db advisors` is run
  - Then no security-level issues are reported for the new table or bucket

---

## Module → Role Matrix update

The following row MUST be added to the module→role matrix in CONVENTIONS.md:

| Module             | admin | agent | Template |
|--------------------|:-----:|:-----:|----------|
| Property expenses  |  yes  |  no   | B        |

---

## Out of scope (restated)

The following are explicitly NOT part of this spec:

- Settlement PDF generation (leg 2)
- Settlement history view (leg 3)
- Dashboard / sidebar visibility (leg 4)
- Deduction math in `owner_settlements` — this spec only makes deductions *queryable*
- Editing or voiding expenses consumed by a closed settlement
- Absorbed-expense (`charged_to_owner = false`) posting to `cash_movements`
- FX conversion between `ARS` and `USD` deduction lines
- Agent-access variant (Template A table + admin-only flag gate)
