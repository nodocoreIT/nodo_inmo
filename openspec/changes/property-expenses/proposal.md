# Proposal: property-expenses

## Intent

Introduce the **Gasto de propiedad** (property expense) entity: the data foundation
for the agency's owner-settlement cycle ("cerrar bien las rendiciones"). An expense is
born at the property — a "Registrar gasto" action on the property card logs an arreglo
or a compra de accesorio, with amount, date, description, and a **receipt photo**.

The single decision that makes this entity worth modeling now rather than later is the
**`charged_to_owner` boolean**: not every expense is deducted from the owner. Some
repairs the agency absorbs as goodwill or warranty; others are passed through to the
owner and become **deduction lines** in that owner's settlement (rendición). Carrying
that flag from day one — instead of bolting it on after expenses exist — avoids a
backfill migration over real receipts and real money.

This change delivers **only leg 1** of the rendiciones roadmap. It builds the entity and
makes its `charged_to_owner = true` rows **available to be consumed** by the settlement
flow. It does not wire the settlement math or UI.

## Why now

- The bigger goal is closing owner settlements correctly. The settlement net is
  `gross collected − commission − deductions = net to owner`. The `owner_settlements`
  and `cash_movements` tables already model gross collection, commission, and payout —
  but **deductions have no source**. Property expenses are that source. Without this
  entity, the rendición is structurally incomplete.
- Building **data-first** means the expense table and its `charged_to_owner` semantics
  must be correct before any PDF, history, or dashboard reads from them. Those three
  later legs are pure consumers; a wrong shape here propagates into all of them.
- Receipt photos are sensitive documents (facturas/tickets with names, amounts, tax
  IDs). The storage and access-control decision must be made deliberately at creation,
  not patched after photos are already public.

## Scope

### In scope

1. **`nodo_inmo.property_expenses` table** — a dedicated business table (not a generic
   cash movement; see Alternatives), org-scoped with `org_id NOT NULL` and RLS enabled,
   following the project's established `nodo_inmo` table conventions (InitPlan-friendly
   policies, `set_updated_at()` trigger).
2. **Conceptual fields** (column-level detail deferred to spec/design):
   - `property_id` — the expense is born at and belongs to a property.
   - `type` — enum-like text: `arreglo` | `compra_accesorio`.
   - `amount` + `currency` (`ARS` | `USD`, matching the caja/payments convention).
   - `expense_date` — when the expense was incurred.
   - `description` — free text.
   - `receipt_path` — pointer to the receipt photo in Supabase Storage (path/key, not
     a public URL).
   - **`charged_to_owner boolean NOT NULL`** — the load-bearing flag. Whether this
     expense becomes a deduction in the owner's settlement.
3. **Supabase Storage bucket** for receipt photos, **private** (not public), with
   Storage RLS policies that scope access to the owning org. A factura photo must never
   be world-readable via a guessable URL.
4. **RLS choice: Template B (admin-only)** for `property_expenses`, consistent with the
   caja/settlement family. Rationale in Approach.
5. **Properties UI touchpoint**: a "Registrar gasto" action on the property card that
   opens a form to create an expense (including photo upload). Feature folder
   `src/features/property-expenses/` (or co-located under properties — decided in
   design), following the existing feature-folder architecture.
6. **Integration point exposed, not wired**: a documented, queryable way for the
   settlement flow to read `charged_to_owner = true` expenses for a given owner/period.
   The actual deduction math and rendición UI are flagged as the next integration, not
   built here.
7. **Tests are first-class** (Strict TDD active): pgTAP for table shape, RLS gate, and
   the storage access policy where expressible; vitest for the create-expense hook/form.

### Out of scope (later legs — this change only feeds them)

- **Leg 2 — Settlement PDF comprobante.** No PDF generation.
- **Leg 3 — Settlement history view.** No history UI.
- **Leg 4 — Dashboard / sidebar visibility.** No dashboard.
- The actual settlement deduction calculation and the `owner_settlements` net-amount
  rewrite. This change makes deductions *available*; consuming them is the next change.
- Editing/voiding expenses already consumed by a settled rendición (lifecycle rules
  belong to the settlement integration, not here).

## Approach

### A dedicated table, not a generic cash movement (the core decision)

A property expense is **not** a cash movement and must not be modeled as a
`cash_movements` row. They answer different questions:

- `cash_movements` is the **agency's money ledger** — actual income and payouts, with a
  derived balance. An expense the agency does *not* absorb (`charged_to_owner = true`)
  never touches the agency's cash at all; it is a deduction the owner bears. Forcing it
  into the ledger would corrupt the balance.
- A property expense needs `property_id`, `type`, a `charged_to_owner` flag, and a
  receipt photo — none of which belong on a generic cash movement, and several of which
  (`property_id`, receipt) would be perpetually nullable noise there.

The dedicated table keeps the ledger honest and gives the settlement flow a clean,
filterable source of deduction lines. (When an expense the agency *absorbs*
— `charged_to_owner = false` — eventually needs to hit the ledger as a real outflow,
that posting is a deliberate later step, mirroring how payments post to caja today.)

### RLS: Template B (admin-only)

Property expenses carry receipt photos and directly affect how much money an owner
receives. They live in the same trust tier as caja and `owner_settlements`, both of
which are **Template B (admin-only)** per the Module→Role matrix in CONVENTIONS.md.
Agents manage operational property data (Template A), but the money story — expenses
that reduce an owner's payout — is admin territory. Choosing Template B keeps the
deduction source and its consumer (`owner_settlements`) under the same access gate, so
an agent can never see or alter what an owner is charged.

> Trade-off: agents register day-to-day property activity but will **not** be able to
> log expenses. If the agency wants agents to register expenses (e.g. field staff
> photographing a receipt) while admins control the `charged_to_owner` decision, that is
> a Template A table with an admin-only gate on the flag — an open question below, not a
> default. Defaulting to B is the safe, reversible-toward-openness choice.

### Storage bucket + access control (called out as the headline risk)

Receipt photos go in a **private** Supabase Storage bucket. The access trap (per the
Supabase skill security checklist):

- The bucket must **not** be public — a public bucket exposes every receipt via a
  predictable object URL with no auth.
- Storage objects are gated by RLS policies on `storage.objects`. Reads/writes must be
  scoped to the owning org (and, matching Template B, to admins). The app reads photos
  via **signed URLs**, never public URLs.
- Supabase Storage **upsert requires INSERT + SELECT + UPDATE** grants together;
  granting only INSERT makes photo replacement silently fail. The policy set must cover
  all three for the bucket.

This is the single most security-sensitive part of the change and the easiest to get
subtly wrong, so it is the headline risk below.

### Integration point with owner_settlements

`nodo_inmo.owner_settlements` is currently one row per cobro (`payment_id`), holding the
owner's share with `pending` / `settled` status. The settlement net today is implicitly
`owner share` with no deduction term. This change does **not** alter that table.

What it provides: property expenses where `charged_to_owner = true`, filterable by
`owner_id` (via the property's owner contact) and by `expense_date`, ready to be summed
as the **deductions** term when the settlement flow is built. The exact linkage shape —
whether deductions attach per-settlement, per-owner-period, or are computed on demand —
is a **design/spec question for the consuming change**, not decided here. The contract
this change commits to: deduction-eligible expenses are queryable and access-gated the
same way the settlement is.

### Feature-folder + TDD shape

The frontend follows the existing `src/features/<feature>/{components,hooks,lib,__tests__}`
convention (as in `src/features/properties/`). Strict TDD is active: the DB layer is
covered by a new `supabase/tests/1XX_property_expenses.test.sql` (table existence, RLS
enabled, Template B gate, storage policy where expressible) and the UI by vitest tests
for the create hook and form, before implementation.

## Risks

1. **Receipt photo exposure (headline).** A misconfigured public bucket or a missing
   Storage RLS policy leaks private facturas. Mitigation: private bucket, org+admin
   scoped `storage.objects` policies, signed-URL reads, INSERT+SELECT+UPDATE for upsert.
   Must be verified, not assumed.
2. **`charged_to_owner` semantics drift.** If the settlement flow later interprets the
   flag differently than intended (e.g. defaulting wrong, or double-counting absorbed
   expenses into the ledger), owner payouts are wrong — real money. The flag's meaning
   must be documented and tested, and the absorbed-vs-passed-through split kept explicit.
2. **Owner derivation via property.** An expense links to a `property_id`; the owner is
   reached through the property→contact relation. If a property's owner changes between
   the expense date and settlement, "who is charged" can become ambiguous. Needs an
   explicit rule in the consuming change (snapshot owner at expense time vs resolve live).
4. **Template B vs agent workflow.** Admin-only may be too strict if field agents are
   the ones holding the receipts. Reversible, but a wrong default creates friction.
5. **Currency / FX on deductions.** Expenses can be `USD` while a settlement is `ARS`
   (or vice versa). Summing deductions across currencies is a settlement-flow problem,
   but the entity must store currency faithfully so that flow can convert correctly.

## Open questions

- **Agent access**: should agents be able to *create* expenses (Template A + admin-only
  flag gate) while admins own the `charged_to_owner` decision, or is full Template B
  admin-only correct for v1? (Proposal defaults to Template B.)
- **Owner snapshot**: at deduction time, is the charged owner the property's owner *as
  of the expense date* or *as of settlement*? (Deferred to the consuming change, but
  flagged so the entity can store what it needs.)
- **Absorbed-expense ledger posting**: do `charged_to_owner = false` expenses eventually
  post to `cash_movements` as a real agency outflow, and if so, when? (Out of scope here;
  noted so the table shape doesn't preclude it.)

## Success looks like

- `nodo_inmo.property_expenses` exists, org-scoped, RLS enabled with Template B policies,
  with `charged_to_owner` as a required boolean — proven by pgTAP.
- A private Storage bucket holds receipt photos, with org+admin-scoped policies; a
  non-owning org (and a non-admin) cannot read another org's receipts — verified.
- "Registrar gasto" on a property card creates an expense with a photo upload, end to end.
- `charged_to_owner = true` expenses are queryable per owner/date, ready for the
  settlement flow to consume as deductions — with that integration point documented.
- The agency's `cash_movements` balance is **untouched** by registering an owner-charged
  expense (no ledger corruption).

## Next recommended

`spec` + `design` for property-expenses (can run in parallel). Spec turns the fields,
RLS template, and storage access rules into testable requirements; design fixes the
exact columns, the Storage bucket + `storage.objects` policy SQL, the owner-derivation
rule, and the queryable contract the settlement flow will consume.
