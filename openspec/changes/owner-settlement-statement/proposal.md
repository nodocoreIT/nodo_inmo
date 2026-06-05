# Proposal: owner-settlement-statement

## Intent

Deliver **leg 2** of the rendiciones roadmap: a printable, shareable **PDF
comprobante** of an owner settlement (rendición). When the agency closes an owner's
pending settlements via "Liquidar" in the Caja → Liquidaciones tab, it must be able to
hand that owner a formal document that shows the full money story —
`gross collected − commission − deductions = net paid` — under the agency's own
branding (logo, razón social, domicilio, CUIT).

Leg 1 (`property-expenses`) created the deduction source but left it unconsumed. Today
`owner_settlements` stores only the owner's share (gross − commission) per cobro, with
**no breakdown, no commission rate, no deductions, no net**. There is nothing to print.
This change closes that gap by **sealing a breakdown at settlement time** and rendering
it as a PDF the agency can download and share.

Success looks like: an admin clicks "Liquidar" for an owner, the settlement is recorded
*with* a frozen breakdown snapshot, consumed deductions are marked so they can never be
double-counted, and the admin can immediately download or share a branded PDF
comprobante for that owner — one per currency.

## Why now

- **The settlement net is structurally incomplete without it.** Leg 1 made
  `charged_to_owner = true` expenses *available*; nothing consumes them. Until the
  settlement flow subtracts deductions and records a net, the rendición the agency gives
  the owner is wrong — real money. This is the leg that makes the cycle correct.
- **Breakdown must be frozen at settlement time, not recomputed later.** A settlement is
  a point-in-time financial fact. `contacts.commission_rate` drifts, expenses get
  re-flagged, payments get added. If the PDF recomputed from live data months later, an
  old comprobante would silently change. Leg 3 (history) and any reprint must read the
  **same immutable snapshot** taken the moment the settlement closed.
- **Branding needs a home that does not exist yet.** A formal comprobante carries the
  agency's razón social, domicilio, and CUIT. There is **no table holding agency
  address/CUIT/logo** today — `shared.organizations` has only `name`/`tier`/`product`.
  Adding that small profile capability is net-new scope that this leg forces, and it is
  better built deliberately now than faked with hardcoded strings.

## Scope

This change has **three sub-components** that build on each other. They are large enough
together that this change will almost certainly ship as **chained PRs** (see Delivery).

### Sub-component A — Agency profile / settings (net-new capability)

The comprobante needs full agency identity. This sub-component adds:

1. **Agency profile data** — `address`, `cuit`, `logo_path`, and any extra
   comprobante fields (e.g. phone/email), stored against the org. **Recommendation: a
   new `nodo_inmo.org_profiles` table** (one row per `org_id`), *not* new columns on
   `shared.organizations`. Rationale: `shared.organizations` is the cross-product
   ecosystem anchor (the foundation change explicitly flags it as shared with future
   Nodo products); inmo-specific billing fields like CUIT/logo are product concerns and
   belong in the `nodo_inmo` schema, not bolted onto a shared table other products own.
   Column-level shape is a spec/design detail.
2. **A Storage bucket for the logo** — **private**, read via signed URL, consistent with
   the receipt-photo decision in leg 1. A logo is low-sensitivity, but defaulting to
   private keeps one Storage access convention across the product (no public-bucket
   special case). Upsert needs INSERT + SELECT + UPDATE grants together (Supabase
   gotcha). Public-bucket is a deliberate alternative to weigh in design, not the default.
3. **A small settings UI** to view/edit the agency profile and upload the logo —
   admin-only, in a Configuración/Settings surface.

RLS: **Template B (admin-only)**, consistent with the caja/settlement family.

### Sub-component B — Breakdown sealing (data + mutation)

Make the settlement record carry its full, frozen breakdown:

1. **`owner_settlements.breakdown` (JSONB, nullable)** — a point-in-time snapshot:
   `{ gross, commission_rate, commission, deductions[], net }`, where `deductions[]`
   lists the consumed expense lines (id, amount, description, date). Immutable once
   written. JSONB chosen over a normalized `owner_settlement_deductions` table because
   the breakdown is read as one whole document (by the PDF and by leg-3 history), is
   never queried field-by-field, and must be tamper-evident as a single frozen blob.
2. **`property_expenses.applied_settlement_id` (nullable FK → owner_settlements)** — the
   **consumed marker**. When a settlement seals, the deductions it absorbed get stamped
   with the settlement id. This is the anti-double-count guard: the next settlement only
   considers expenses where `applied_settlement_id IS NULL`. Chosen over a date-range
   recompute (unreliable, double-count risk) and over a separate
   `settlement_expense_links` join table (heavier; a single FK is enough for one-to-many
   consumption).
3. **Extended `useSettleOwner` mutation** — instead of only flipping status to
   `settled`, it now: queries that owner's unconsumed chargeable expenses
   (`applied_settlement_id IS NULL`, matching currency), calls a **pure
   `computeSettlementBreakdown()`** (in `caja-math.ts`) to derive gross / commission /
   deductions / net, writes the `breakdown` JSONB onto the settlement row(s), and stamps
   `applied_settlement_id` on the consumed expenses. **All under normal Template B RLS —
   the `SECURITY DEFINER` payment trigger is NOT touched** (extending that sensitive,
   privilege-bypassing surface for breakdown work would be the wrong place; settlement
   is an admin action that already runs with admin RLS).

> Note: because a "Liquidar" today operates on *multiple* pending settlement rows for one
> owner (one per cobro), the breakdown is an owner-level aggregate. Where the snapshot
> physically lands — one breakdown per row, or one aggregate row — is a spec/design
> decision; the contract here is "one immutable breakdown per owner per currency per
> liquidación".

### Sub-component C — PDF comprobante + sharing

1. **A React-PDF document** (`@react-pdf/renderer`) rendering the sealed breakdown plus
   the agency profile header (logo, name, domicilio, CUIT) and owner details — real
   vector PDF with selectable text. **Loaded via dynamic import** so ~300 KB never
   inflates the admin bundle (Vercel `bundle-dynamic-imports` rule).
2. **Download** — `pdf(doc).toBlob()` → object URL → download.
3. **Share** — **Web Share API** `navigator.share({ files })` for mobile (WhatsApp et
   al.), with graceful desktop fallback to download. Zero extra infra.

This repo is a **pure Vite + React SPA + Supabase**: `supabase/functions/` does not
exist, so client-side PDF generation is the proportionate choice — no Edge Function /
server round-trip introduced for this leg.

### Out of scope (later legs / future)

- **Leg 3 — settlement history list** (reading the sealed breakdowns) and reprint UI.
- **Leg 4 — dashboard / sidebar rendición visibility.**
- **Storage-hosted PDF + WhatsApp signed-link deep link** — a future leg; this leg shares
  via download + Web Share only, no hosted artifact.
- **Email delivery** and **owner-portal access** to the comprobante.
- Re-opening / amending an already-sealed settlement (lifecycle rules beyond
  seal-once).

## Approach

### How the three sub-components relate

```
[A] agency profile  ─┐
                     ├─►  [C] PDF comprobante  ──►  download / Web Share
[B] sealed breakdown ┘
```

B is the **content** (the frozen money story); A is the **letterhead** (who is issuing
it); C **composes** both into the printable artifact. A and B are independent of each
other and can be built in parallel; C depends on both being queryable.

### Data-model changes (conceptual; DDL deferred to spec/design)

- `nodo_inmo.org_profiles` — new admin-only (Template B) table, one row per org, holding
  `address`, `cuit`, `logo_path`, and comprobante contact fields.
- `nodo_inmo.owner_settlements.breakdown jsonb` — nullable snapshot column; immutable
  once a settlement is sealed.
- `nodo_inmo.property_expenses.applied_settlement_id uuid` — nullable FK →
  `owner_settlements(id)`; the consumed marker (indexed for the
  `IS NULL` filter on the hot settlement query).
- Storage: one **private** bucket for the agency logo, org+admin-scoped
  `storage.objects` policies (INSERT + SELECT + UPDATE for upsert), signed-URL reads.

### Multi-currency

One comprobante **per owner per currency group** — matching the existing
`groupPendingByOwner` key (`owner_id:currency`) in `caja-math.ts`. An owner with both
ARS and USD pending produces two logical settlements and two PDFs. No cross-currency FX
conversion in this leg.

### Decisions already settled (do not re-litigate)

| Decision | Choice | One-line rationale |
|---|---|---|
| Breakdown timing | **Seal at settlement time** (not lazy recompute) | A settlement is a point-in-time fact; live data drifts. |
| Breakdown storage | **JSONB on `owner_settlements`** | Read as one immutable document; never queried field-by-field. |
| Consumed marker | **`applied_settlement_id` FK on `property_expenses`** | Reliable anti-double-count; simpler than a join table or date-range. |
| Mutation surface | **Extend `useSettleOwner` under normal RLS** | Admin action already runs with admin RLS; don't grow the `SECURITY DEFINER` trigger. |
| PDF engine | **`@react-pdf/renderer`, client-side, dynamic import** | No Edge Functions exist; real vector PDF; bundle kept lazy. |
| Sharing | **Download + Web Share API** | Zero infra; mobile WhatsApp via `navigator.share({files})`. |
| Branding source | **New `nodo_inmo.org_profiles` (not `shared.organizations`)** | CUIT/logo are inmo product data; the shared table is cross-product. |
| Multi-currency | **One PDF per owner per currency** | Matches existing `owner_id:currency` grouping. |

## Risks

1. **Double-counting deductions (highest).** The whole correctness of the rendición
   rests on `applied_settlement_id` being stamped atomically with the seal. If the
   breakdown writes but the expense stamp fails (or vice versa), the next settlement
   re-consumes the same expense. The seal + stamp must be one transaction; verify with a
   test that a second settlement sees zero already-consumed expenses.
2. **commission_rate / data drift.** Mitigated by design — the snapshot freezes rate and
   amounts. But the compute function must read the rate *as of seal time*, and the PDF
   must read the snapshot, never live data. Tested explicitly.
3. **Bundle inflation.** `@react-pdf/renderer` (~300 KB) MUST be dynamically imported;
   a static import in the admin path is a regression. Guard in review.
4. **Multi-currency boundary.** Two-currency owners produce two artifacts; the UI and
   the seal must not merge them. The `owner_id:currency` key is the boundary.
5. **Agency-profile incompleteness at first run.** An org that has not filled its profile
   (no CUIT/logo) must still produce a usable PDF (graceful placeholders), not crash.
6. **Storage logo access.** Private bucket + org-scoped `storage.objects` policies;
   signed-URL reads; INSERT+SELECT+UPDATE for upsert (Supabase gotcha). Lower stakes than
   leg-1 receipts but follows the same convention.
7. **Seal-once lifecycle.** Re-settling an already-sealed owner is out of scope; the
   mutation should refuse to re-seal a settlement that already has a breakdown, so a
   double-click can't overwrite a frozen snapshot.

## Delivery — this change is LARGE; chained PRs recommended

Three sub-components touching DB migrations, a new Storage bucket, a new settings UI, the
settle mutation, a pure compute function, a PDF document, and share wiring — plus pgTAP
and vitest for each — will comfortably exceed a single reviewable PR budget. Suggested
natural split (each independently shippable, in dependency order):

- **PR-A — Agency profile.** `org_profiles` migration + Template B RLS + logo Storage
  bucket/policies + settings UI + tests. Independent; no dependency on B or C.
- **PR-B — Breakdown sealing.** `breakdown` JSONB + `applied_settlement_id` FK migration,
  `computeSettlementBreakdown()` pure fn, extended `useSettleOwner` mutation, pgTAP +
  vitest. Depends on nothing in A.
- **PR-C — PDF comprobante + share.** `@react-pdf/renderer` document, download + Web
  Share in the Liquidaciones tab, hook wiring. Depends on A (branding) and B (breakdown).

A and B can be developed in parallel; C integrates last. `sdd-tasks` should produce the
final PR boundaries and size forecast.

## Success looks like

- An admin fills the agency profile (logo, razón social, domicilio, CUIT) once in
  settings; it persists per org, admin-only, logo in a private bucket.
- Clicking "Liquidar" for an owner seals the settlement **with** a frozen
  `breakdown` snapshot and stamps the consumed expenses' `applied_settlement_id`.
- A second "Liquidar" for the same owner sees **zero** already-consumed expenses — no
  double-count, proven by test.
- The admin downloads or shares (Web Share) a branded PDF comprobante showing
  `gross − commission − deductions = net`, one per currency.
- An owner with ARS and USD pending gets two correct comprobantes.

## Next recommended

`spec` + `design` for owner-settlement-statement (can run in parallel). Spec turns the
three sub-components into testable requirements (profile fields + RLS, breakdown JSONB
shape + seal/consume invariants, PDF content contract, share behavior). Design fixes the
exact DDL (`org_profiles` columns, `breakdown` JSONB schema, `applied_settlement_id` FK +
index), the `storage.objects` policy SQL for the logo bucket, the
`computeSettlementBreakdown()` signature, the seal-once guard, and the dynamic-import +
Web Share wiring — and confirms the PR-A/B/C boundaries.
