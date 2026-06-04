# Exploration: owner-settlement-statement (leg 2 — PDF comprobante of owner settlement)

## Current Money Flow

### Payments / Cuotas
- Table `nodo_inmo.payments` — one row per contract-month: `contract_id`, `period` (YYYY-MM-01), `due_date`, `amount`, `currency`, `status` (pending/paid/cancelled), `paid_date`, `paid_amount`.
- Mark-paid: `src/features/payments/components/payments-list.tsx` → `useUpdatePayment` sets `status='paid'`, `paid_date=today`, `paid_amount=amount`. No partial-payment model.
- Migration: `supabase/migrations/20260603180006_create_payments.sql`.

### Commission Split (Trigger)
- `nodo_inmo.post_payment_to_caja()` fires AFTER UPDATE on `payments` when `status` → `'paid'`.
- Migration: `supabase/migrations/20260603203600_payment_caja_posting.sql`.
- Joins `contracts → properties → contacts` for `owner_id` + `commission_rate`. Computes `commission = round(amount*rate/100,2)`, `owner_share = amount - commission`. Inserts one `cash_movements` row (`source='commission'`, `type='income'`) and one `owner_settlements` row (`status='pending'`, `amount=owner_share`).
- SECURITY DEFINER (lets Template A agents trigger writes to admin-only Caja tables). Idempotency via existing-commission check + `ON CONFLICT DO NOTHING` on `unique(payment_id)`.

### Owner Settlements (current state)
- Table `nodo_inmo.owner_settlements`: `id`, `org_id`, `owner_id`, `payment_id`, `amount` (owner share = gross − commission), `currency`, `status` (pending/settled), `settled_date`.
- **No breakdown stored** — no gross_rent, commission_amount, commission_rate, deductions, net_amount.
- `use-owner-settlements.ts` fetches with owner name; `use-settle-owner.ts` marks pending → settled (`settled_date=today`), no payout cash_movement (Accounting model A).
- UI: `caja-page.tsx` SettlementsTab → `groupPendingByOwner` (caja-math.ts) groups by `owner_id:currency`, shows total + "Liquidar".

### Caja / Cash Movements
- `nodo_inmo.cash_movements`: `type`, `amount`, `source` (manual/commission/owner_payout), `payment_id` (nullable), `owner_id` (nullable). Template B RLS. Commission income rows linked to `payment_id` — commission for a batch recoverable via `cash_movements WHERE source='commission' AND payment_id IN (...)`.

### Deductions Seam (leg 1)
- `nodo_inmo.property_expenses` + view `nodo_inmo.owner_chargeable_expenses` (security_invoker) exposing `owner_id`, `amount`, `currency`, `expense_date`, `type`, `description` for `charged_to_owner=true`.
- **Gap**: no `applied_settlement_id` — expenses can't be linked to a settlement batch; recompute needs a date-range convention and risks double-counting.

### Chain & Auth
- `contacts.commission_rate` (numeric(5,2) default 10.00) — one rate per owner contact. Chain: `contacts ← properties.owner_id ← contracts.property_id ← payments.contract_id ← owner_settlements.payment_id`.
- JWT `app_metadata`: `org_id`, `role`. Settlement statement is admin-only (Template B).

## Affected Areas
- `supabase/migrations/` — extend `owner_settlements` (breakdown) + add `applied_settlement_id` FK on `property_expenses`.
- `src/features/caja/hooks/use-settle-owner.ts` — persist breakdown snapshot, mark consumed expenses.
- `src/features/caja/hooks/use-owner-settlements.ts` — load breakdown.
- `src/features/caja/lib/caja-math.ts` — add pure `computeSettlementBreakdown()`.
- `src/features/caja/components/caja-page.tsx` — download/share action.
- NEW `src/features/caja/components/settlement-statement-document.tsx` (React-PDF).
- NEW `src/features/caja/hooks/use-settlement-statement.ts`.
- `package.json` — add `@react-pdf/renderer`.

## Recommendation 1 — Breakdown persistence
**Persist a breakdown snapshot on `owner_settlements` at settlement time (not lazy recompute at PDF time).**
- Approach A (JSONB `breakdown` column) — simple, immutable point-in-time doc, leg 3 reads same column. **Chosen.**
- Approach B (normalized `owner_settlement_deductions` table) — more relational, more work.
- Approach C (lazy recompute by date range) — no schema change but unreliable, double-count risk, commission_rate drift. Rejected.
- Also add `applied_settlement_id` (nullable FK → owner_settlements) on `property_expenses` to mark deductions consumed.
- Extended `useSettleOwner`: query uncharged owner expenses (`applied_settlement_id IS NULL`), compute gross/commission/deductions/net, write `breakdown` JSONB, set `applied_settlement_id` on consumed expenses.

## Recommendation 2 — PDF generation
**`@react-pdf/renderer`, client-side, dynamic import.**
- `edge_runtime` is configured in config.toml but `supabase/functions/` does NOT exist — Edge Function = greenfield infra, disproportionate.
- `@react-pdf/renderer` = real vector PDF, selectable text, React JSX layout, ~300 KB gzip lazy-loaded (satisfies dynamic-import rule), works with existing admin auth, no server round-trip.
- Alternatives: jspdf+autotable (smaller, imperative) second choice; jspdf+html2canvas (rasterized) avoid; Edge Function (Deno) high effort.

## Sharing
No existing PDF/share pattern in src. Leg 2: (1) Download via `pdf(doc).toBlob()` + object URL; (2) Web Share API `navigator.share({files})` for mobile WhatsApp, graceful desktop fallback. Future: upload blob to private Storage bucket + signed URL → WhatsApp deep link (leg 2.5/3).

## Scope
**In (leg 2)**: migration (breakdown JSONB + applied_settlement_id), extended settle mutation, `computeSettlementBreakdown()`, React-PDF document, download + Web Share, unit tests.
**Out**: history list (leg 3), dashboard (leg 4), Storage-hosted PDF + signed link (leg 3), email (leg 3+), owner-portal access.

## Open Questions for Proposal
1. Consumed marker: `applied_settlement_id` FK on `property_expenses` vs a `settlement_expense_links` join table?
2. Breakdown storage: JSONB on `owner_settlements` (recommended) vs normalized table?
3. Agency branding on PDF (logo, name, address, CUIT) — no org profile/settings table exists. Where does it live?
4. Multi-currency: one PDF per currency group per owner, or combined?
5. Web Share API sufficient, or WhatsApp link (Storage-hosted) required for leg 2?
6. Re-settling an already-settled owner: new breakdown row or amend?

## Risks
1. Deduction "consumed" marker gap is the highest-complexity fork — decide mutation-side vs date-range before spec.
2. commission_rate drift → persist snapshot, don't recompute.
3. `@react-pdf/renderer` MUST be dynamically imported to avoid inflating admin bundle.
4. Multi-currency owner → two logical PDFs; define the boundary.
5. No Edge Functions exist — avoid server-side PDF unless audit storage is firm.
6. Extending the SECURITY DEFINER payment trigger expands a sensitive surface — handle breakdown at settlement-time mutation under normal RLS instead.
