# Proposal: historial-rendiciones

## Intent

Deliver **leg 3** of the rendiciones roadmap: a **history of settled rendiciones** that
the agency can browse, expand, and re-share. Leg 2 (`owner-settlement-statement`) made
each "Liquidar" seal an immutable `breakdown` snapshot and produce a PDF comprobante.
That snapshot is written and then effectively lost — there is no surface that reliably
lists *all* past settlements so the agency can answer "what did we pay this owner last
month, and can you resend the comprobante?".

Today the Caja → **Liquidaciones** tab has a "Liquidaciones realizadas" section that
*tries* to show sealed settlements, but it is **broken for history use**:
`groupSealedByOwner` in `caja-page.tsx` groups sealed rows by `owner_id:currency`, so
only the **most recent** settlement per owner per currency survives — every earlier
rendición is silently dropped. The frozen breakdowns from leg 2 exist in the database but
are unreachable past the latest one.

Success looks like: an admin opens a dedicated **Historial** tab, sees a chronological
list of every sealed rendición (newest first), expands any row to read its full frozen
breakdown (`gross − commission − deductions = net`, with the deduction lines), and
re-downloads or re-shares that exact comprobante — all reading the **same immutable
snapshot** leg 2 sealed, never a recompute.

## Why now

- **Leg 2 produces history that nothing can read.** Every settlement seals a
  point-in-time breakdown, but the only place that surfaces them collapses to one row per
  owner. The data exists and is accumulating; without leg 3 it is write-only. This leg
  makes the sealed snapshots actually usable.
- **The grouping bug is a silent data-loss UX bug, not just a missing feature.** An agency
  that settles the same owner twice sees the first rendición vanish from the UI. That
  looks like the system "forgot" a payment. Fixing `groupSealedByOwner` to key on
  `settlement_group` (the UUID leg 1/2 already stamps per liquidación) is the correct fix
  and it unblocks the whole history surface.
- **Re-share is a real operational need.** Owners lose the PDF, ask for it again months
  later. The comprobante is already an immutable artifact (leg 2); re-rendering it from
  the stored breakdown is free and correct. The only thing missing is a list to find the
  settlement and a button to reprint — which is exactly this leg.

## Scope

This is a **read-and-display** change. No DB migrations, no new mutations, no new RLS —
RLS is already correct (Template B, org-scoped + admin) and `owner_settlements` already
holds everything needed. The work is a new tab, a new read hook, a history table with an
expandable breakdown, and reuse of the existing share/download actions.

### In scope

1. **Fix the history-collapse bug.** `groupSealedByOwner` must group by
   **`settlement_group` (UUID)**, not `owner_id:currency`, so every sealed liquidación is
   preserved as its own history entry. This is the load-bearing correctness fix.
2. **New `Historial` tab on `CajaPage`** — a third tab alongside "Movimientos" and
   "Liquidaciones".
3. **New read hook (`useSettledSettlements`)** — fetches `status = 'settled'`, ordered
   `settled_date DESC`, grouped by `settlement_group`, `.limit(50)`. A separate hook from
   `useOwnerSettlements` (which fetches pending + settled together for the Liquidaciones
   tab) so the history query is purpose-built and bounded.
4. **History table with an expandable row** — collapsed row shows the headline
   (owner, currency, `settled_date`, net, cobro_count); expanding reveals the full
   breakdown: `gross`, `commission_rate`/`commission`, the `deductions[]` lines
   (description, date, amount), `deduction_total`, and `net`.
5. **Reuse `SealedSettlementActions`** for Descargar / Compartir per history row — the PDF
   re-renders from the stored `breakdown`, no new PDF code.
6. **Clean up the Liquidaciones tab.** Remove the broken "Liquidaciones realizadas"
   section (or simplify it to a last-settlement-only summary), now that history lives in
   its own tab. Liquidaciones returns to being only about *pending* work.

### Out of scope (later legs / future)

- **Leg 4 — dashboard / sidebar rendición visibility.**
- **Pagination beyond the first 50.** No pagination pattern exists in the codebase; this
  leg ships a bounded `.limit(50)` newest-first and defers infinite scroll / page controls.
- **Server-side filtering/search** (by owner, date range, property). The MVP is a flat
  recent list; filters are a follow-up.
- **A composite index `(org_id, settled_date) WHERE status = 'settled'`.** Not a blocker
  at current data volumes with a 50-row limit; flag for design as a cheap future
  optimization, not part of this leg.
- **Re-opening / amending a sealed settlement.** History is read-only; the seal-once
  lifecycle from leg 2 stands.
- **Owner-portal / email access** to history.

## Approach

### Why a separate tab and a separate hook

History and pending work are different jobs with different shapes. Liquidaciones is an
**action surface** over *pending* rows (group, select, "Liquidar"); Historial is a
**read surface** over *settled* rows (browse, expand, reprint). Bolting history onto the
Liquidaciones tab is exactly what produced the current broken section. A dedicated tab
keeps each surface single-purpose, and a dedicated `useSettledSettlements` hook lets the
history query be bounded (`status='settled'`, `DESC`, `limit 50`) without perturbing the
existing `useOwnerSettlements` flow that the Liquidaciones tab depends on.

### The grouping fix is the spine of this leg

```
BEFORE: groupSealedByOwner → key = owner_id:currency → 1 row per owner (history lost)
AFTER:  group by settlement_group (UUID)             → 1 row per liquidación (history kept)
```

`settlement_group` is already stamped on every sealed row by the existing flow and is also
embedded inside the `breakdown` JSONB. Each distinct `settlement_group` is exactly one
"Liquidar" event for one owner+currency at one point in time — the natural unit of a
history entry. Keying on it is what turns "latest only" into "full history".

### Reading the sealed breakdown (no recompute)

Every history row renders from its frozen `breakdown` JSONB — the same snapshot leg 2
sealed:

```ts
{
  version: 1, currency, gross, commission_rate, commission,
  owner_share, deductions: [{id, amount, description, expense_date, type}],
  deduction_total, net, settlement_group, sealed_at, cobro_count
}
```

The history table reads these fields directly. **No live recompute**, consistent with the
leg-2 decision that a settlement is a point-in-time fact. Re-share/re-download feed the
same `breakdown` back into the existing `@react-pdf/renderer` document via
`SealedSettlementActions`, so the reprinted comprobante is byte-for-byte the original
money story.

### Null-breakdown guard must survive

`breakdown` is **nullable** in the schema (pre-leg-2 settlements, or any unsealed edge).
The grouping/render path MUST keep a `if (!s.breakdown) continue` guard so a legacy
settlement without a snapshot is skipped rather than crashing the list. This is a known
gotcha carried over from leg 2 — do not drop it during the regroup refactor.

### Decisions already settled (do not re-litigate)

| Decision | Choice | One-line rationale |
|---|---|---|
| History grouping key | **`settlement_group` UUID** (not `owner_id:currency`) | One liquidación = one history entry; fixes silent data loss. |
| Read hook | **New `useSettledSettlements`** (separate from `useOwnerSettlements`) | Purpose-built bounded query; doesn't disturb the pending flow. |
| Query bound | **`status='settled'`, `settled_date DESC`, `.limit(50)`** | No pagination pattern exists; bounded newest-first is the safe MVP. |
| Surface | **New 3rd `Historial` tab on `CajaPage`** | Separates read-history from the pending action surface. |
| Breakdown rendering | **Read frozen `breakdown` JSONB, no recompute** | A settlement is a point-in-time fact (leg-2 decision). |
| Re-share / re-download | **Reuse `SealedSettlementActions`** | The PDF already renders from `breakdown`; zero new PDF code. |
| Liquidaciones tab | **Remove/Simplify the broken "realizadas" section** | History now lives in its own tab; pending stays pending. |
| DB / RLS | **No migration, no new policy** | `owner_settlements` + Template B RLS already suffice. |

## Risks

1. **Regrouping regression (highest).** Changing `groupSealedByOwner`'s key from
   `owner_id:currency` to `settlement_group` touches a shared grouping helper. If the
   Liquidaciones tab's "realizadas" summary still calls it during the transition, its
   behavior changes too. Mitigation: do the regroup and the Liquidaciones-tab cleanup in
   the same change so no caller is left depending on the old collapsing behavior; cover
   "two settlements for the same owner both appear" with a test.
2. **Dropped null-breakdown guard.** A legacy `settled` row with `breakdown = null` must be
   skipped, not rendered. Losing the `if (!s.breakdown) continue` guard during the
   refactor crashes the history list. Explicitly preserved and tested.
3. **Unbounded growth without an index.** At higher volumes a `settled_date DESC` scan
   without the `(org_id, settled_date) WHERE status='settled'` index degrades. The
   `.limit(50)` keeps it safe for the MVP; flag the index for design as a follow-up, not a
   blocker.
4. **Tab state / data coupling.** Three tabs now share `CajaPage`. The new hook should
   fetch independently (its own bounded query) so switching to Historial doesn't refetch
   or perturb Movimientos/Liquidaciones state.
5. **Re-share parity.** The reprinted PDF must be identical to the original. Because both
   read the same frozen `breakdown`, this holds by construction — but verify the history
   row passes the *stored* breakdown to `SealedSettlementActions`, never a re-derived one.

## Estimated size

**Small** — roughly **180–280 changed lines**, comfortably within a single PR budget:

- `useSettledSettlements` hook (new) — ~40–60 lines.
- `groupSealedByOwner` regroup by `settlement_group` (+ guard) — ~20–40 lines changed.
- `Historial` tab + history table with expandable breakdown row — ~80–120 lines.
- Liquidaciones tab cleanup (remove/simplify "realizadas") — ~20–40 lines removed/changed.
- Tests (regroup correctness, null-breakdown skip, history ordering) — ~40–60 lines.

No DB migration, no new RLS, no new PDF code. Single PR is appropriate; no chaining needed.

## Success looks like

- The admin opens a **Historial** tab in Caja and sees every sealed rendición, newest
  first, up to 50.
- An owner settled **twice** shows **both** entries — the older one no longer vanishes.
- Expanding a row reveals the full frozen breakdown:
  `gross − commission − deductions = net`, with each deduction line.
- Descargar / Compartir on any history row reproduces the **original** comprobante from
  its stored `breakdown`.
- A legacy `settled` row with `breakdown = null` is skipped cleanly, not crashed.
- The Liquidaciones tab is back to being only about pending work.

## Next recommended

`spec` + `design` for historial-rendiciones (can run in parallel). Spec turns the scope
into testable requirements (regroup-by-`settlement_group` invariant, null-breakdown skip,
`status='settled'`/`DESC`/`limit 50` query contract, expandable-row breakdown content,
re-share-from-stored-breakdown behavior, Liquidaciones-tab cleanup). Design fixes the
`useSettledSettlements` signature and return shape, the exact `groupSealedByOwner`
refactor, the Historial table/expandable-row component structure, the `SealedSettlementActions`
wiring per row, and whether the Liquidaciones "realizadas" section is removed outright or
reduced to a last-settlement summary.
