# Spec: owner-settlement-statement

Leg 2 of the rendiciones roadmap: agency profile, breakdown sealing, and PDF comprobante.
Each requirement is verifiable. Scenarios use Given/When/Then. "MUST" is normative.

Test targets: **pgTAP** for all DB requirements; **vitest** for compute / hook / UI
requirements. Strict TDD is active — every requirement below is phrased so that a failing
test can be written before a single line of production code exists.

---

## Sub-component A — Agency Profile / Settings

### Capability A1 — `nodo_inmo.org_profiles` table shape

#### R-A1 — Table exists in the correct schema
`nodo_inmo.org_profiles` MUST exist as a regular table in the `nodo_inmo` schema.

- **Scenario: table present (pgTAP)**
  - Given the org-profiles migration has been applied
  - When `information_schema.tables` is queried for `table_schema = 'nodo_inmo'` and
    `table_name = 'org_profiles'`
  - Then exactly one row is returned

#### R-A2 — Required columns and types
The table MUST have the following columns with the specified types and nullability:

| Column       | Type          | Nullable | Constraint                               |
|--------------|---------------|----------|------------------------------------------|
| `id`         | `uuid`        | NOT NULL | PRIMARY KEY, default `gen_random_uuid()` |
| `org_id`     | `uuid`        | NOT NULL | UNIQUE, FK → `shared.organizations(id)`  |
| `address`    | `text`        | NULL     |                                          |
| `cuit`       | `text`        | NULL     |                                          |
| `logo_path`  | `text`        | NULL     |                                          |
| `phone`      | `text`        | NULL     |                                          |
| `email`      | `text`        | NULL     |                                          |
| `created_at` | `timestamptz` | NOT NULL | default `now()`                          |
| `updated_at` | `timestamptz` | NOT NULL | default `now()`                          |

- **Scenario: column presence and types (pgTAP)**
  - Given the migration has been applied
  - When `information_schema.columns` is queried for each required column on
    `nodo_inmo.org_profiles`
  - Then each column exists with the specified data type and nullability

#### R-A3 — `org_id` is unique (one profile per org)
The table MUST enforce a UNIQUE constraint on `org_id`. Attempting to insert a second
profile for the same org MUST be rejected.

- **Scenario: duplicate org_id rejected (pgTAP)**
  - Given a profile row already exists for org A
  - When a second INSERT with `org_id = A` is attempted
  - Then Postgres rejects it with a unique-constraint violation

#### R-A4 — `updated_at` is auto-maintained
The `updated_at` column MUST be updated automatically on every UPDATE via the project's
`set_updated_at()` trigger.

- **Scenario: trigger fires on update (pgTAP)**
  - Given an existing org_profiles row inserted at time T
  - When the row is updated (e.g. address changed) at time T+1
  - Then `updated_at` reflects T+1 and is greater than `created_at`

#### R-A5 — `logo_path` stores the storage key, not a URL
`logo_path` MUST contain the storage object key (e.g. `<org_id>/logo.png`), never a
pre-signed or public URL. Signed URLs are generated at read time.

- **Scenario: path format (vitest — unit test on the upload hook)**
  - Given the admin saves a logo
  - When `logo_path` is written to the database
  - Then its value does not start with `https://` or `http://`

---

### Capability A2 — RLS on `org_profiles` (Template B, admin-only)

#### R-A6 — RLS enabled
`nodo_inmo.org_profiles` MUST have row-level security enabled.

- **Scenario: RLS on (pgTAP)**
  - Given the migration has been applied
  - When `pg_class.relrowsecurity` is checked for `org_profiles`
  - Then it is `true`

#### R-A7 — Admin can read own-org profile
A user with `app_metadata.role = 'admin'` and `app_metadata.org_id = A` MUST be able to
SELECT the profile row where `org_id = A`.

- **Scenario: admin reads own org (pgTAP)**
  - Given a profile row for org A
  - And a JWT with `app_metadata = { "org_id": "<A>", "role": "admin" }`
  - When a SELECT is issued
  - Then the row is returned

#### R-A8 — Admin can insert and update own-org profile
A user with `app_metadata.role = 'admin'` and `app_metadata.org_id = A` MUST be able to
INSERT a profile row for org A and UPDATE it afterwards.

- **Scenario: admin insert succeeds (pgTAP)**
  - Given a JWT with `app_metadata = { "org_id": "<A>", "role": "admin" }`
  - When an INSERT with `org_id = A` is executed
  - Then the row is committed
- **Scenario: admin update succeeds (pgTAP)**
  - Given a profile row for org A
  - And a JWT with `app_metadata = { "org_id": "<A>", "role": "admin" }`
  - When an UPDATE changes `address`
  - Then the row reflects the new address

#### R-A9 — Non-admin is blocked from all operations
A user with `app_metadata.role = 'agent'` MUST receive zero rows on SELECT and a policy
rejection on INSERT/UPDATE/DELETE.

- **Scenario: agent SELECT returns zero rows (pgTAP)**
  - Given a profile row exists for org A
  - And a JWT with `app_metadata = { "org_id": "<A>", "role": "agent" }`
  - When a SELECT is issued
  - Then zero rows are returned
- **Scenario: agent INSERT is rejected (pgTAP)**
  - Given a JWT with `app_metadata = { "org_id": "<A>", "role": "agent" }`
  - When an INSERT is attempted
  - Then it is rejected by the RLS policy

#### R-A10 — Cross-org read is blocked
An admin of org A MUST NOT be able to read the profile of org B.

- **Scenario: cross-org SELECT blocked (pgTAP)**
  - Given profile rows for org A and org B
  - And a JWT scoped to org A with role `admin`
  - When a SELECT is issued
  - Then only the org A profile is returned; org B profile is invisible

#### R-A11 — `org_id` cannot be reassigned via UPDATE
The UPDATE policy MUST include both `USING` and `WITH CHECK` so that a row's `org_id`
cannot be changed to a different org.

- **Scenario: org reassignment blocked (pgTAP)**
  - Given an admin of org A owns a profile row
  - When the admin attempts to set `org_id = B`
  - Then the update is rejected by the `WITH CHECK` clause

#### R-A12 — Unauthenticated access is blocked
The `anon` role MUST receive zero rows on SELECT and a rejection on INSERT.

- **Scenario: anon blocked (pgTAP)**
  - Given a profile row exists
  - When a SELECT is issued without authentication
  - Then zero rows are returned

---

### Capability A3 — Logo Storage bucket

#### R-A13 — Private bucket exists
A Supabase Storage bucket named `org-logos` MUST exist and MUST be configured as private
(`public = false`).

- **Scenario: bucket is private (pgTAP)**
  - Given the migration has been applied
  - When `storage.buckets` is queried for `name = 'org-logos'`
  - Then a row exists with `public = false`

#### R-A14 — Admin can upload, re-upload (upsert), and read logo
The storage policy MUST grant INSERT, SELECT, and UPDATE on `storage.objects` for the
path `<org_id>/<filename>` when the requester is an admin of that org. All three grants
are required for upsert to function correctly (Supabase upsert gotcha).

- **Scenario: admin upload succeeds**
  - Given a JWT with `app_metadata = { "org_id": "<A>", "role": "admin" }`
  - When the client calls `supabase.storage.from('org-logos').upload('<A>/logo.png', ...)`
  - Then the file is stored and a subsequent `.createSignedUrl(...)` returns a valid URL
- **Scenario: admin re-upload (upsert) succeeds**
  - Given the admin has already uploaded a logo at `<A>/logo.png`
  - When the admin uploads again to the same path with `{ upsert: true }`
  - Then the file is replaced without error

#### R-A15 — Non-admin cannot read or write logos
A user with `role = 'agent'` MUST NOT be able to download or upload logos.

- **Scenario: agent upload blocked**
  - Given a JWT with `app_metadata = { "org_id": "<A>", "role": "agent" }`
  - When the agent calls `.upload(...)` on the `org-logos` bucket
  - Then the request is denied by the storage policy
- **Scenario: agent signed-URL blocked**
  - Given a logo exists in the bucket
  - And a JWT with `app_metadata = { "role": "agent", "org_id": "<A>" }`
  - When the agent calls `.createSignedUrl(...)`
  - Then the request is denied

#### R-A16 — Cross-org logo access blocked
An admin of org A MUST NOT be able to read or write a logo belonging to org B
(path prefix `<B>/`).

- **Scenario: cross-org download blocked**
  - Given a logo at `<B>/logo.png`
  - And a JWT scoped to org A with role `admin`
  - When the admin attempts `.createSignedUrl('<B>/logo.png', ...)`
  - Then the request is denied by the storage policy

#### R-A17 — Logos are never served via public URL
Accessing a logo MUST require a signed URL. No logo MUST be reachable at a predictable
unauthenticated URL.

- **Scenario: public URL returns no file**
  - Given a logo uploaded by an admin
  - When the public URL pattern is requested without authentication
  - Then the response is 400 or 404

---

### Capability A4 — Settings UI

#### R-A18 — Settings page is accessible only to admins
The agency profile settings UI MUST be reachable by users with `role = 'admin'` and MUST
NOT render (or must redirect) for users with `role = 'agent'`.

- **Scenario: admin can navigate to settings (vitest/RTL)**
  - Given a session with `role = 'admin'`
  - When the settings route renders
  - Then the agency profile form is present in the document
- **Scenario: agent cannot access settings (vitest/RTL)**
  - Given a session with `role = 'agent'`
  - When the settings route renders
  - Then the agency profile form is NOT present (route guard blocks or redirects)

#### R-A19 — Settings form collects all profile fields
The settings form MUST include inputs for: agency name (read from `shared.organizations`),
`address`, `cuit`, `phone`, `email`, and a logo file upload. All fields except logo file
input are text inputs.

- **Scenario: form renders all fields (vitest/RTL)**
  - Given the settings page is rendered for an admin
  - Then the following controls are present: address input, CUIT input, phone input,
    email input, and a file input for the logo

#### R-A20 — Saving the profile upserts the org_profiles row
Submitting the settings form MUST call `supabase.from('org_profiles').upsert(...)` with
the correct `org_id` and field values. A second save MUST update, not reject.

- **Scenario: upsert on save (vitest — unit test on the settings hook)**
  - Given the settings form is filled and submitted
  - When the save action completes
  - Then `supabase.from('org_profiles').upsert(...)` was called once with the correct payload
- **Scenario: second save updates (vitest)**
  - Given a profile already exists for the org
  - When the admin saves the form again
  - Then the upsert succeeds (no unique-constraint rejection)

#### R-A21 — Logo upload precedes profile save
If the admin uploads a new logo, the file MUST be uploaded to Storage first; the resulting
storage key MUST be set as `logo_path` in the upsert payload. If the upload fails, the
profile row is not written.

- **Scenario: upload-then-upsert ordering (vitest)**
  - Given the admin has selected a logo file
  - When the save action runs
  - Then `supabase.storage.upload(...)` is called before `supabase.from('org_profiles').upsert(...)`
  - And if `storage.upload` rejects, `upsert` is never called

#### R-A22 — Profile is optional: missing profile does not crash the app
A missing `org_profiles` row (org that has not filled its profile) MUST be handled
gracefully. Any UI that reads the profile MUST render with placeholder/empty values, not
throw an uncaught error.

- **Scenario: missing profile renders placeholders (vitest/RTL)**
  - Given no `org_profiles` row exists for the org
  - When any component that consumes the profile is rendered
  - Then it renders without throwing and displays empty/placeholder values for name,
    address, CUIT, logo

---

## Sub-component B — Breakdown Sealing

### Capability B1 — Schema extensions

#### R-B1 — `owner_settlements.breakdown` column exists
The column `breakdown` of type `jsonb`, nullable, MUST be added to
`nodo_inmo.owner_settlements`.

- **Scenario: column present (pgTAP)**
  - Given the breakdown-sealing migration has been applied
  - When `information_schema.columns` is queried for `nodo_inmo.owner_settlements`
  - Then a column named `breakdown` of type `jsonb` exists and is nullable

#### R-B2 — `property_expenses.applied_settlement_id` column and FK exist
A nullable column `applied_settlement_id uuid` MUST be added to
`nodo_inmo.property_expenses`, with a FOREIGN KEY referencing `nodo_inmo.owner_settlements(id)`.

- **Scenario: column and FK present (pgTAP)**
  - Given the migration has been applied
  - When `information_schema.columns` is queried for `nodo_inmo.property_expenses`
  - Then a column named `applied_settlement_id` of type `uuid` exists and is nullable
- **Scenario: FK constraint present (pgTAP)**
  - Given the migration has been applied
  - When `information_schema.referential_constraints` is queried
  - Then a constraint exists linking `property_expenses.applied_settlement_id` →
    `owner_settlements(id)`

#### R-B3 — `applied_settlement_id` has an index for `IS NULL` filter performance
An index MUST exist on `nodo_inmo.property_expenses(applied_settlement_id)` to make the
"unconsumed expenses" query efficient at scale.

- **Scenario: index present (pgTAP)**
  - Given the migration has been applied
  - When `pg_indexes` is queried for `nodo_inmo.property_expenses`
  - Then at least one index covers the `applied_settlement_id` column

---

### Capability B2 — `computeSettlementBreakdown()` pure function

#### R-B4 — Function signature
`computeSettlementBreakdown` MUST be a pure function (no side-effects, no network calls)
exported from `src/features/caja/lib/caja-math.ts`. Its signature MUST be:

```ts
computeSettlementBreakdown(
  payments: { id: string; amount: number; currency: string }[],
  commissionMovements: { payment_id: string; amount: number }[],
  expenses: { id: string; amount: number; currency: string; expense_date: string; description: string; type: string }[],
  commissionRate: number,
  currency: string
): SettlementBreakdown
```

Where `SettlementBreakdown` is:
```ts
{
  gross: number;
  commission_rate: number;
  commission: number;
  deductions: { id: string; amount: number; description: string; expense_date: string; type: string }[];
  net: number;
}
```

- **Scenario: function is exported (vitest)**
  - Given the module is imported
  - When `computeSettlementBreakdown` is destructured
  - Then it is a function (not undefined)

#### R-B5 — `gross` is the sum of settled payment amounts
`gross` MUST equal the sum of all `payments[i].amount` passed to the function for the
given currency.

- **Scenario: gross computation (vitest)**
  - Given two payments of 1000 and 500 in ARS
  - When `computeSettlementBreakdown` is called
  - Then `result.gross === 1500`

#### R-B6 — `commission` is derived from cash_movements (source='commission')
`commission` MUST equal the sum of `commissionMovements[i].amount` for movements whose
`payment_id` is in the payments list — NOT recomputed from `commissionRate * gross`.
`commission_rate` in the snapshot is the rate as provided (read from `contacts` at seal time).

- **Scenario: commission from movements (vitest)**
  - Given payments [P1, P2] and commission movements [{ payment_id: P1.id, amount: 100 },
    { payment_id: P2.id, amount: 50 }]
  - When `computeSettlementBreakdown` is called
  - Then `result.commission === 150`
- **Scenario: commission_rate is stored verbatim (vitest)**
  - Given `commissionRate = 10`
  - When `computeSettlementBreakdown` is called
  - Then `result.commission_rate === 10`

#### R-B7 — `deductions` lists only expenses matching the settlement currency
`deductions` MUST contain only expenses whose `currency` matches the `currency` argument.
Cross-currency expenses MUST be excluded.

- **Scenario: currency isolation in deductions (vitest)**
  - Given expenses [{ currency: 'ARS', amount: 200 }, { currency: 'USD', amount: 50 }]
  - And `currency = 'ARS'`
  - When `computeSettlementBreakdown` is called
  - Then `result.deductions` has length 1 and `result.deductions[0].amount === 200`

#### R-B8 — `net` equals `gross − commission − sum(deductions)`
`net` MUST equal `gross - commission - deductions.reduce((s, d) => s + d.amount, 0)`,
rounded to 2 decimal places.

- **Scenario: net computation (vitest)**
  - Given `gross = 1000`, `commission = 100`, `deductions = [{ amount: 50 }, { amount: 30 }]`
  - When `computeSettlementBreakdown` is called with the matching inputs
  - Then `result.net === 820`
- **Scenario: net with no deductions (vitest)**
  - Given `gross = 1000`, `commission = 100`, no expenses
  - When `computeSettlementBreakdown` is called
  - Then `result.net === 900`
- **Scenario: net is rounded to 2 decimal places (vitest)**
  - Given inputs that produce a fractional net
  - When `computeSettlementBreakdown` is called
  - Then `result.net` has at most 2 decimal places

#### R-B9 — Function is pure: same inputs always produce same output
Calling `computeSettlementBreakdown` twice with identical arguments MUST return
structurally equal results.

- **Scenario: referential purity (vitest)**
  - Given fixed inputs
  - When the function is called twice
  - Then both return values are deeply equal

---

### Capability B3 — `useSettleOwner` mutation (extended)

#### R-B10 — Mutation queries unconsumed chargeable expenses before sealing
Before writing to the database, `useSettleOwner` MUST query
`nodo_inmo.property_expenses` filtered by:
- `charged_to_owner = true`
- `applied_settlement_id IS NULL`
- `currency` matching the settlement currency
- owner derived via `properties.owner_contact_id`

- **Scenario: unconsumed-only query (vitest — unit test on the mutation hook)**
  - Given an admin triggers Liquidar for owner O in ARS
  - When `useSettleOwner` executes
  - Then a Supabase query is issued that includes `.is('applied_settlement_id', null)` and
    `.eq('currency', 'ARS')` on `property_expenses`

#### R-B11 — Already-consumed expenses are never included
An expense with a non-null `applied_settlement_id` MUST NOT appear in any breakdown.

- **Scenario: consumed expense excluded (vitest)**
  - Given two expenses for owner O: E1 with `applied_settlement_id = <some_id>`, E2 with
    `applied_settlement_id = null`
  - When `useSettleOwner` builds the breakdown
  - Then only E2 appears in `result.deductions`

#### R-B12 — Breakdown snapshot is written to `owner_settlements.breakdown`
After computing the breakdown, the mutation MUST write the `SettlementBreakdown` object
as JSONB to `owner_settlements.breakdown` for the sealed row(s).

- **Scenario: breakdown written (vitest)**
  - Given `useSettleOwner` resolves successfully
  - When the test inspects all mocked Supabase calls
  - Then a call to `from('owner_settlements').update({ breakdown: { ... } })` is found
    and the breakdown object matches the output of `computeSettlementBreakdown`

#### R-B13 — Consumed expenses are stamped with `applied_settlement_id`
After sealing, the mutation MUST update every expense that was included in `deductions`
to set `applied_settlement_id = <settlement_id>`.

- **Scenario: stamp on consumed expenses (vitest)**
  - Given `useSettleOwner` resolves successfully with two deductions D1 and D2
  - When the test inspects all mocked Supabase calls
  - Then a call to `from('property_expenses').update({ applied_settlement_id: <id> })`
    is found, targeting exactly D1 and D2 by id

#### R-B14 — Seal and stamp are atomic (all-or-nothing)
The settlement status update, the breakdown write, and the `applied_settlement_id` stamps
MUST all succeed or all fail together. A partial write (breakdown without stamps, or stamps
without breakdown) MUST NOT occur.

- **Scenario: atomic failure — partial write rejected (vitest)**
  - Given the `property_expenses` update is mocked to throw after the settlement update
    and breakdown write succeed
  - When `useSettleOwner` is called
  - Then the mutation surfaces an error
  - And the test verifies that both the settlement update and the expense stamp would
    need to be undone (implementation enforces this via a Postgres transaction or
    explicit rollback logic in the hook; the spec requires the invariant, design chooses
    the mechanism)

#### R-B15 — Seal-once guard: re-sealing a settled settlement is refused
If the targeted `owner_settlements` row(s) already have a non-null `breakdown`, the
mutation MUST refuse to proceed and return an error — no overwrite of the frozen snapshot.

- **Scenario: double-seal blocked (vitest)**
  - Given one or more settlement rows for owner O that already have `breakdown IS NOT NULL`
  - When `useSettleOwner` is triggered for owner O
  - Then the mutation returns an error before any database write
  - And the existing `breakdown` and `applied_settlement_id` values are unchanged

#### R-B16 — A second settlement for the same owner sees zero already-consumed expenses
After a first Liquidar for owner O seals and stamps expenses E1 and E2, a subsequent
Liquidar for the same owner (new pending payments) MUST compute deductions from only
the new unconsumed expenses.

- **Scenario: no double-counting (vitest — integration-style)**
  - Given owner O had settlements sealed (E1 and E2 now have `applied_settlement_id` set)
  - And a new pending settlement exists for O with new expense E3 (`applied_settlement_id IS NULL`)
  - When `useSettleOwner` is called for the new pending settlement
  - Then `computeSettlementBreakdown` receives `expenses = [E3]` only — E1 and E2 are absent

---

### Capability B4 — Breakdown JSONB integrity

#### R-B17 — Breakdown snapshot includes all required fields
A breakdown written to `owner_settlements.breakdown` MUST contain the keys `gross`,
`commission_rate`, `commission`, `deductions`, and `net`. `deductions` MUST be an array;
each element MUST include at minimum `id`, `amount`, `description`, `expense_date`.

- **Scenario: shape validation (vitest — assert on the computed value before it is written)**
  - Given `computeSettlementBreakdown` is called with valid inputs
  - Then the result has keys `gross`, `commission_rate`, `commission`, `deductions`, `net`
  - And `deductions` is an array
  - And each deduction element has keys `id`, `amount`, `description`, `expense_date`

#### R-B18 — Breakdown is immutable once written (no update path exists)
There MUST be no code path in `useSettleOwner` or any other hook that updates
`owner_settlements.breakdown` on an already-sealed row. The seal-once guard (R-B15)
is the only mechanism to prevent overwrite.

- **Scenario: no update-breakdown path (vitest — static)**
  - Given the `useSettleOwner` source is inspected
  - Then no code path reaches a `breakdown` update when the settlement already has a
    non-null `breakdown` (seal-once guard short-circuits before any DB call)

---

## Sub-component C — PDF Comprobante and Sharing

### Capability C1 — Bundle isolation (dynamic import)

#### R-C1 — `@react-pdf/renderer` is dynamically imported
The PDF document component MUST be loaded via dynamic import (e.g. `React.lazy` +
`import(...)` or equivalent). A static top-level import of `@react-pdf/renderer` in any
file on the admin bundle critical path MUST NOT exist.

- **Scenario: no static import on critical path (vitest — static analysis or import scan)**
  - Given the source files for the caja feature are inspected
  - Then no file that is statically reachable from the main admin entry point contains a
    top-level `import ... from '@react-pdf/renderer'`
- **Scenario: dynamic import present (vitest)**
  - Given the hook or component that triggers PDF generation
  - When it is called
  - Then the PDF module is loaded via a dynamic `import()` call

---

### Capability C2 — PDF document content

#### R-C2 — Document renders agency header
The PDF document MUST render an agency header section containing:
- Agency name (from `org_profiles` / `organizations.name` if profile absent)
- Address (from `org_profiles.address`; blank if absent)
- CUIT (from `org_profiles.cuit`; blank if absent)
- Logo image (from signed URL if `org_profiles.logo_path` is set; omitted if absent)

Missing profile fields MUST produce blank placeholders, not render errors.

- **Scenario: header with full profile (vitest — render test on the document component)**
  - Given a profile with `address = 'Av. Corrientes 1234'`, `cuit = '30-12345678-9'`, and
    a `logo_path`
  - When the PDF document component is rendered
  - Then the output includes "Av. Corrientes 1234", "30-12345678-9", and the logo source
- **Scenario: header with missing profile (vitest)**
  - Given no `org_profiles` row for the org (profile is `null`)
  - When the PDF document component is rendered
  - Then it renders without throwing and address/CUIT fields are empty strings

#### R-C3 — Document renders owner and period section
The PDF document MUST include the owner's full name and the settlement period
(e.g. "Liquidación al DD/MM/YYYY" using `owner_settlements.settled_date`).

- **Scenario: owner and period rendered (vitest)**
  - Given an owner named "Juan Pérez" and `settled_date = '2026-06-01'`
  - When the document component is rendered
  - Then the output includes "Juan Pérez" and "01/06/2026" (or equivalent locale-formatted date)

#### R-C4 — Document renders the breakdown table
The PDF document MUST render a table with the following rows in order:
1. Gross collected (`breakdown.gross`)
2. Commission (`breakdown.commission`, labelled with `breakdown.commission_rate`)
3. One row per deduction in `breakdown.deductions` (description, date, amount)
4. Net total (`breakdown.net`)

- **Scenario: breakdown table rows present (vitest)**
  - Given `breakdown = { gross: 1500, commission_rate: 10, commission: 150, deductions: [{ description: 'Arreglo', expense_date: '2026-05-01', amount: 200 }], net: 1150 }`
  - When the document component is rendered
  - Then the output includes "1500", "150", "10%", "Arreglo", "200", and "1150"

#### R-C5 — All monetary amounts in the document match the breakdown snapshot
The document MUST read all amounts from the frozen `breakdown` JSONB — never from live
queries or re-computations.

- **Scenario: snapshot-only rendering (vitest)**
  - Given the document component receives `breakdown` as a prop
  - When it renders
  - Then it does not call any Supabase client method
  - And its output values match the `breakdown` prop fields exactly

#### R-C6 — Currency is labelled on all amount fields
Every monetary amount in the document MUST be labelled with its currency code
(e.g. "ARS 1500" or "$ 1500 ARS"). Cross-currency confusion MUST be impossible within one document.

- **Scenario: currency label present (vitest)**
  - Given `currency = 'ARS'`
  - When the document component is rendered
  - Then all amount fields include "ARS"

---

### Capability C3 — Download

#### R-C7 — Download produces a valid application/pdf blob
Calling the download action MUST invoke `pdf(doc).toBlob()` from `@react-pdf/renderer`
and trigger a browser download with MIME type `application/pdf`.

- **Scenario: toBlob called on download (vitest)**
  - Given the download action is triggered
  - When the action completes
  - Then `pdf(document).toBlob()` was called
  - And a DOM anchor with `download` attribute was programmatically clicked (or equivalent
    download trigger)

#### R-C8 — Download filename includes owner name and currency
The downloaded file MUST be named in a way that identifies the owner and currency, e.g.
`liquidacion-<owner-slug>-ARS.pdf`.

- **Scenario: filename format (vitest)**
  - Given owner "Juan Pérez" and currency "ARS"
  - When the download action triggers
  - Then the anchor's `download` attribute matches the pattern
    `liquidacion-juan-perez-ARS.pdf` (or equivalent normalized slug)

---

### Capability C4 — Web Share

#### R-C9 — Web Share is offered when the API is available
When `navigator.share` is defined and `navigator.canShare({ files })` returns true, the
UI MUST display a "Compartir" (Share) action that calls `navigator.share({ files: [pdfFile] })`.

- **Scenario: share button visible when API available (vitest/RTL)**
  - Given `navigator.share` is mocked to a function and `navigator.canShare` returns `true`
  - When the settlement PDF component renders
  - Then a "Compartir" button is present in the document

#### R-C10 — Graceful fallback when Web Share is unavailable
When `navigator.share` is undefined or `navigator.canShare({ files })` returns false,
the "Compartir" action MUST be hidden or replaced by the download action. The component
MUST NOT throw.

- **Scenario: share button absent when API unavailable (vitest/RTL)**
  - Given `navigator.share` is undefined
  - When the settlement PDF component renders
  - Then no "Compartir" button is present
  - And the download action is the only sharing option shown

#### R-C11 — Share presents the PDF as a File object
The file passed to `navigator.share({ files: [...] })` MUST be a `File` object with
`type = 'application/pdf'` and a name matching the download filename convention (R-C8).

- **Scenario: file object type (vitest)**
  - Given the share action is triggered
  - When `navigator.share` is called
  - Then `args.files[0]` is a `File` with `type === 'application/pdf'`

---

### Capability C5 — Multi-currency isolation at the PDF layer

#### R-C12 — One PDF per owner per currency
The UI MUST generate separate PDF documents for each currency group. An owner with ARS
and USD pending MUST result in two distinct download/share actions, one per currency.

- **Scenario: two-currency owner produces two actions (vitest/RTL)**
  - Given owner O has one sealed ARS settlement and one sealed USD settlement
  - When the settlement UI renders
  - Then two separate "Descargar PDF" (or equivalent) actions are present, one labelled ARS
    and one labelled USD
- **Scenario: amounts in ARS PDF do not include USD amounts (vitest)**
  - Given the above two settlements
  - When the ARS document is rendered
  - Then its `breakdown.gross` equals only the ARS gross amount, not the USD gross

#### R-C13 — Cross-currency amounts never appear in the same breakdown
`computeSettlementBreakdown` enforces currency isolation (R-B7). The PDF layer MUST pass
only the relevant currency's payments, commission movements, and expenses to
`computeSettlementBreakdown`. A misrouted currency must fail explicitly in tests.

- **Scenario: no cross-currency leak (vitest)**
  - Given payments P1 (ARS) and P2 (USD) for the same owner
  - When `computeSettlementBreakdown` is called with `currency = 'ARS'`
  - Then the USD payment P2 does not contribute to `gross`, `commission`, or `deductions`

---

## Module → Role Matrix update

The following rows MUST be added to the module → role matrix in CONVENTIONS.md:

| Module                    | admin | agent | Template |
|---------------------------|:-----:|:-----:|----------|
| Agency profile (settings) |  yes  |  no   | B        |
| Owner settlement PDF      |  yes  |  no   | B        |

---

## Advisors and security posture

#### R-SEC1 — Advisors report no security errors
After applying the breakdown-sealing and org-profiles migrations, `supabase db advisors`
(or MCP `get_advisors`) MUST report zero security errors for `nodo_inmo.org_profiles`,
the `owner_settlements` and `property_expenses` extensions, and the `org-logos` bucket
storage policies.

- **Scenario: advisors clean**
  - Given both migrations are applied locally
  - When `supabase db advisors` is run
  - Then no security-level issues are reported for the new table, new columns, or bucket

---

## Out of scope (restated)

The following are explicitly NOT part of this spec:

- Settlement history list and reprint UI (leg 3)
- Dashboard / sidebar settlement visibility (leg 4)
- Storage-hosted PDF with WhatsApp signed-link deep link (leg 3)
- Email delivery of the comprobante
- Owner-portal access to settlements
- Re-opening or amending an already-sealed settlement
- FX conversion between ARS and USD
- Partial payments or split-currency deductions within one settlement
- Edge Functions or server-side PDF generation
