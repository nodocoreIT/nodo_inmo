# Spec: historial-rendiciones

## Scope

Delta spec for leg 3 of the rendiciones roadmap. Describes what MUST be true after the
change is applied. Does not describe implementation.

---

## Requirements

### REQ-01 — Query contract for settled settlements

The data layer MUST expose a bounded query that returns only settled settlements:

- `status = 'settled'`
- ordered by `settled_date DESC`
- limited to 50 rows
- scoped to the authenticated org (RLS Template B enforces this; the query must not add its own org filter that could conflict or duplicate)

### REQ-02 — Grouping invariant: one entry per `settlement_group`

The history list MUST produce exactly one entry per distinct `settlement_group` UUID.
Grouping by `owner_id:currency` is forbidden in the history surface. A single owner
settled twice MUST produce two separate history entries.

### REQ-03 — Null-breakdown rows are skipped

If a `settled` row has `breakdown = null` (legacy or unsealed edge case), the history
list MUST skip that row silently. The list MUST NOT crash, throw, or render a broken entry
for a null-breakdown row.

### REQ-04 — Historial tab exists in CajaPage

`CajaPage` MUST render a third tab labelled "Historial" alongside "Movimientos" and
"Liquidaciones". The Historial tab MUST be accessible without navigating away from Caja.

### REQ-05 — History table collapsed row content

Each row in the history table MUST display, in its collapsed (default) state:

- Owner name (or identifier)
- Currency
- `settled_date` (formatted date)
- Net amount (`breakdown.net`)
- Cobro count (`breakdown.cobro_count`)

### REQ-06 — Expandable row: full frozen breakdown

Each row in the history table MUST be expandable. When expanded, the row MUST reveal the
full breakdown read from the stored `breakdown` JSONB:

- `gross`
- `commission_rate` and `commission`
- `deductions[]` — each deduction MUST show: `description`, `expense_date`, `amount`
- `deduction_total`
- `net`

The math relationship `gross − commission − deduction_total = net` MUST be visually
communicable (labels present in the UI that allow a reader to follow the arithmetic).

### REQ-07 — Re-share and re-download read stored breakdown, no recompute

The Descargar and Compartir actions on a history row MUST feed the row's stored
`breakdown` JSONB — unmodified — to `SealedSettlementActions`. The PDF produced MUST be
identical to the one generated at settlement time. No recalculation of any field is
permitted.

### REQ-08 — Liquidaciones tab no longer contains "realizadas" section

After this change, the Liquidaciones tab MUST NOT render a "Liquidaciones realizadas"
section that lists past settlements. The Liquidaciones tab scope is limited to pending
work. Any residual UI element from the old section MUST be removed or replaced by at most
a neutral last-settlement summary that does not list multiple historical rows.

### REQ-09 — Independent data fetch for Historial tab

The Historial tab's data hook MUST be separate from `useOwnerSettlements`. Mounting or
switching to the Historial tab MUST NOT trigger a refetch of Movimientos or Liquidaciones
data, and vice versa.

### REQ-10 — Empty state

When there are no settled settlements for the org, the Historial tab MUST render an
explicit empty state (e.g., "No hay rendiciones liquidadas aún") rather than a blank or
broken layout.

---

## Acceptance Scenarios

### S-01 — Two settlements for the same owner both appear

**Given** an org has two `owner_settlements` rows with status `'settled'` for the same
`owner_id` and `currency`, each with a distinct `settlement_group` UUID and a non-null
`breakdown`

**When** the agency navigates to the Historial tab

**Then** the history table shows exactly two rows — one per settlement group — ordered
by `settled_date DESC`, and neither row is missing or overwritten by the other

---

### S-02 — Null-breakdown row is skipped

**Given** an org has one `settled` row with `breakdown = null` and one `settled` row with
a valid `breakdown`

**When** the agency navigates to the Historial tab

**Then** the history table shows exactly one row (the one with a valid breakdown); no
error is thrown; no blank or broken row is rendered for the null-breakdown entry

---

### S-03 — Expanding a row shows the full frozen breakdown

**Given** the Historial tab lists a settled settlement with a valid `breakdown`

**When** the agency clicks/taps to expand that row

**Then** the expanded panel shows `gross`, `commission_rate`, `commission`, each entry in
`deductions[]` with its description/date/amount, `deduction_total`, and `net` — all
values matching the stored `breakdown` JSONB exactly

---

### S-04 — Re-share produces the original comprobante

**Given** a history row is visible with a valid `breakdown`

**When** the agency taps "Compartir" or "Descargar"

**Then** `SealedSettlementActions` receives the stored `breakdown` object unchanged, and
the generated PDF content is identical to what was produced at settlement time (same
gross, commission, deductions, net, `sealed_at`)

---

### S-05 — Query returns settled rows only, newest first, bounded at 50

**Given** an org has 60 settled settlements and 5 pending settlements

**When** `useSettledSettlements` fetches data

**Then** the result contains exactly 50 rows, all with `status = 'settled'`, ordered so
the row with the most recent `settled_date` is first, and no pending rows appear

---

### S-06 — Liquidaciones tab no longer lists past settlements

**Given** an org has multiple settled settlements

**When** the agency navigates to the Liquidaciones tab

**Then** no section listing multiple past settlements is visible; the tab shows only
pending settlement content (pending cobros, grouping, Liquidar action)

---

### S-07 — Empty state for no settled settlements

**Given** an org has zero `settled` settlements

**When** the agency navigates to the Historial tab

**Then** an explicit empty-state message is displayed and the tab does not crash or render
an empty table with no indication

---

### S-08 — Historial tab is independent of other tabs

**Given** the agency is on the Movimientos or Liquidaciones tab

**When** the agency switches to the Historial tab

**Then** the Historial tab data is fetched independently; no existing Movimientos or
Liquidaciones query is re-executed as a side effect of the tab switch

---

## Constraints

- **No DB migration.** `owner_settlements` schema is unchanged. No new tables, columns, or
  indexes are introduced as part of this change.
- **No new RLS policy.** RLS Template B (org-scoped + admin) already covers
  `owner_settlements`. The spec does not require any RLS change.
- **No new PDF code.** Re-share reuses `SealedSettlementActions` exactly as it exists
  after leg 2. No new `@react-pdf/renderer` document or template.
- **No pagination UI.** The 50-row limit is a query-level bound. No infinite scroll, page
  controls, or cursor is introduced by this spec.
- **No server-side filtering.** Search by owner, date range, or property is out of scope.
- **Breakdown is read-only.** No amendment, re-open, or mutation of a sealed settlement.

---

## Out of scope (not testable in this change)

- Leg 4 (dashboard / sidebar visibility)
- A composite index `(org_id, settled_date) WHERE status = 'settled'`
- Owner-portal or email access to history
- Pagination beyond the first 50 rows
