# Design: owner-settlement-statement

Technical design for **leg 2** of the rendiciones roadmap: a branded, shareable **PDF
comprobante** of an owner settlement. This is the source of truth for `tasks` and `apply`.

SQL here is written to run against the shared Supabase project via the Supabase MCP
(`execute_sql` to iterate, then committed as a migration with `supabase db pull` — same
provenance as `create_caja.sql` and `create_property_expenses.sql`). Frontend follows the
existing `src/features/<feature>/{components,hooks,lib,__tests__}` convention.

This change builds three sub-components in dependency order (PR-A profile, PR-B sealing,
PR-C pdf+share). It does **not** build the settlement history list (leg 3), the dashboard
(leg 4), Storage-hosted PDFs / WhatsApp deep links, or email delivery.

---

## 0. Two headline design points (read these first)

### HEADLINE-1 — Atomicity invariant: seal + stamp + flip are ONE transaction

> **Invariant:** For a given `(owner_id, currency)` liquidación, writing the `breakdown`
> snapshot, stamping `property_expenses.applied_settlement_id` on every consumed
> deduction, and flipping `owner_settlements.status` to `settled` MUST all commit
> together or all roll back. **No interleaving, no partial state.**

The correctness of every rendición rests on this. If the breakdown writes but the expense
stamp fails (or vice versa), the next liquidación re-consumes the same expense and the
owner is double-charged — real money, silently wrong. The current `useSettleOwner` does a
single `.update(...).in("id", ids)` (one statement, naturally atomic). The extended flow
touches **three** tables across **multiple** statements, which a client cannot make atomic
over the Data API (each `supabase.from(...)` call is its own round-trip / transaction).

**Decision: a Postgres function `nodo_inmo.settle_owner(...)` (RPC), `SECURITY INVOKER`.**
The whole seal runs inside one DB transaction under the caller's RLS. The client makes one
`supabase.rpc('settle_owner', ...)` call instead of three sequential mutations. This is the
single most important structural decision in the change — see ADR-2.

### HEADLINE-2 — Single source of truth for the computation: SQL is canonical

> **Decision:** The canonical settlement computation (gross, commission, deductions, net)
> lives **in the `settle_owner` RPC body, in SQL**. The TS `computeSettlementBreakdown()`
> in `caja-math.ts` is **NOT** re-run to produce the sealed snapshot — the snapshot the PDF
> renders is exactly what the RPC wrote and returned.

We deliberately avoid two computation engines that could drift. The seal is computed once,
server-side, and frozen as JSONB. The TS pure function exists for **one** narrow purpose:
**pre-seal display** in the UI (showing the admin the projected `gross − commission −
deductions = net` *before* they confirm "Liquidar"), and as a **unit-testable mirror** of
the same arithmetic so the rules are documented and regression-guarded in vitest. It never
feeds the PDF and never overwrites the snapshot. The PDF reads `owner_settlements.breakdown`
verbatim. See ADR-5.

If the TS mirror and the SQL canonical ever disagree, that is a **bug in the mirror**, and
a vitest fixture (same inputs → same outputs as a pgTAP golden case) catches it.

---

## 1. Architecture decisions (ADR-style)

### ADR-1 — Agency profile in a new `nodo_inmo.org_profiles` table, NOT columns on `shared.organizations`

- **Decision:** A new admin-only (Template B) table `nodo_inmo.org_profiles`, one row per
  org (`org_id` is both PK and FK → `shared.organizations(id)`), holding `legal_name`,
  `address`, `cuit`, `phone`, `email`, `logo_path`.
- **Rationale:** `shared.organizations` is the cross-product ecosystem anchor (the
  foundation change explicitly flags it as shared with future Nodo products and exposes
  only `name`/`tier`/`product`). CUIT, domicilio, and a comprobante logo are **inmo
  product concerns** — billing/letterhead data other Nodo products do not share. Bolting
  them onto a shared table other products own is a boundary violation: it forces every
  future product to carry inmo's nullable fiscal columns. A `1:1` profile table in the
  `nodo_inmo` schema keeps the shared table clean and the product data in the product
  schema. `org_id` as PK enforces exactly one profile per org at the schema level.
- **Rejected:** Adding `address`/`cuit`/`logo_path` columns to `shared.organizations`.
  Rejected — leaks product-specific fiscal data into the cross-product anchor; any other
  Nodo product reading `organizations` inherits irrelevant nullable columns.
- **Rejected:** A generic key/value `org_settings(org_id, key, value)`. Rejected —
  untyped, unqueryable, no per-field constraints (e.g. CUIT format), over-engineered for a
  fixed small set of letterhead fields.

### ADR-2 — `settle_owner` RPC (`SECURITY INVOKER`) for the atomic seal — NOT client-side multi-mutation, NOT the SECURITY DEFINER trigger

- **Decision:** Implement the seal as `nodo_inmo.settle_owner(p_owner_id uuid,
  p_currency text, p_settlement_ids uuid[])` — a `SECURITY INVOKER`, `plpgsql` function
  that runs the full seal in one transaction. The client calls
  `supabase.schema("nodo_inmo").rpc("settle_owner", {...})`.
- **Rationale:**
  - **Atomicity (HEADLINE-1).** Function body = one transaction. Either the breakdown +
    stamp + status flip all commit or none do. A client doing three `.from(...).update()`
    calls cannot get this — a crash between calls leaves the DB half-sealed.
  - **`SECURITY INVOKER`, not `DEFINER`.** Settling is an **admin** action that already
    runs under admin RLS (Template B). The function executes with the caller's privileges,
    so the existing `owner_settlements` / `property_expenses` Template B policies still
    gate every row it touches — no privilege bypass, no new attack surface. This is the
    Supabase guidance: never reach for `SECURITY DEFINER` to "make it work"; invoker keeps
    RLS in force.
  - **The `SECURITY DEFINER` payment trigger is NOT touched.** `post_payment_to_caja()` is
    a privilege-bypassing surface that exists so *agents* can indirectly write to admin
    tables when marking a cobro paid. Settlement is a different actor (admin) and a
    different lifecycle (closing, not opening). Growing the trigger to do breakdown work
    would expand the most sensitive surface in the schema for no reason.
- **Function placement & exposure:** Lives in the **`nodo_inmo` schema** (already API-
  exposed in `config.toml`). Because it is `SECURITY INVOKER`, the default `EXECUTE` grant
  to `PUBLIC` is safe — the function can do nothing the caller's own RLS would not already
  allow. It additionally self-checks `app_metadata.role = 'admin'` and `org_id` match as
  defense-in-depth (and to fail fast with a clear error rather than silently affecting 0
  rows). `set search_path = ''` and fully-qualify every object (mirrors the trigger).
- **Rejected:** Client-side sequential mutations (today's pattern, extended). Rejected —
  cannot be atomic over the Data API; the double-count risk is unacceptable for money.
- **Rejected:** `SECURITY DEFINER` RPC. Rejected — settlement does not need to bypass RLS;
  invoker is strictly safer and sufficient.

### ADR-3 — Breakdown as JSONB snapshot on `owner_settlements`, written by the RPC, immutable after seal

- **Decision:** Add `owner_settlements.breakdown jsonb` (nullable). The RPC computes the
  full money story once and writes it onto the settlement rows of the liquidación. Once a
  row has a non-null `breakdown` it is frozen — the RPC **refuses to re-seal** a row that
  already has one (seal-once guard, ADR-7).
- **Rationale:** A settlement is a point-in-time financial fact. `contacts.commission_rate`
  drifts, expenses get re-flagged, payments get added. The PDF and leg-3 history must read
  the **same immutable snapshot** taken the moment the settlement closed, never live data.
  JSONB (not a normalized `owner_settlement_deductions` table) because the breakdown is
  read as **one whole document** by the PDF and history, is never queried field-by-field,
  and must be tamper-evident as a single frozen blob.
- **Where the snapshot lands (multi-row liquidación).** A "Liquidar" operates on *multiple*
  pending `owner_settlements` rows for one owner (one per cobro). The breakdown is an
  **owner-level aggregate** for the whole liquidación. **Decision: write the identical
  aggregate `breakdown` JSONB onto every row in the liquidación batch**, and tag each with
  a shared `settlement_group` UUID (see §2) so the PDF query can fetch "the liquidación"
  by one id. Rationale: keeps the existing one-row-per-cobro model intact (no destructive
  schema change to a table with a `unique(payment_id)` and a live trigger writing it),
  while giving the PDF a single grouping key. The aggregate is small (a few deduction
  lines); duplicating it across N rows is cheap and makes any single row self-describing
  for leg-3 reprint.
- **Rejected:** One new aggregate "statement" row separate from the per-cobro rows.
  Rejected for this leg — introduces a second settlement entity and a parent/child model
  the trigger and existing queries don't know about; heavier than tagging rows with a group
  id. Revisit in leg 3 if history needs a first-class statement row.
- **Rejected:** Normalized `owner_settlement_deductions` table. Rejected — relational
  overkill for a frozen document read whole; more migration + join surface.

### ADR-4 — `property_expenses.applied_settlement_id` FK as the consumed marker (anti-double-count)

- **Decision:** Add `property_expenses.applied_settlement_id uuid` (nullable, FK →
  `owner_settlements(id)`, `on delete set null`), with a partial index. When the RPC seals,
  it stamps this column on every deduction it absorbed. The next liquidación's deduction
  query filters `applied_settlement_id is null`.
- **Rationale:** This is the reliable anti-double-count guard. A `NULL` marker means
  "available"; a stamped value means "already rendered to the owner in settlement X". It is
  set **inside the same transaction** as the breakdown write (HEADLINE-1), so the two can
  never disagree. `on delete set null` (not cascade) so deleting a settlement row never
  silently deletes the expense receipt — it just frees the expense to be re-consumed.
- **Rejected:** Date-range recompute ("sum chargeable expenses between last settlement and
  now"). Rejected — fragile, double-counts on backdated expenses, no hard guarantee.
- **Rejected:** A `settlement_expense_links` join table. Rejected — a single nullable FK is
  enough for one-settlement-consumes-many-expenses; a join table adds a table and a write
  for no extra expressiveness here.
- **Which `owner_settlements.id` is stamped?** The liquidación has N rows. **Stamp the
  `settlement_group` UUID is NOT an FK target** — instead stamp `applied_settlement_id`
  with the **first (deterministic, lowest id) settlement row** of the batch as the
  canonical anchor. The FK stays valid and `on delete set null` only frees expenses if that
  specific anchor row is deleted. (Tasks may simplify to "any one row in the batch"; the
  invariant that matters is *stamped exactly once, atomically*.)

### ADR-5 — Computation single-sourced in SQL; TS pure fn is display-only mirror (see HEADLINE-2)

- **Decision:** Canonical compute = SQL in `settle_owner`. `computeSettlementBreakdown()`
  in `caja-math.ts` is a pure TS function used only for **pre-seal projection in the UI**
  and as a **vitest-guarded mirror**. It does not produce the sealed snapshot.
- **Rationale:** Avoids two drifting sources of truth for money. The seal is authoritative;
  the PDF renders the seal verbatim; the TS mirror documents and regression-tests the same
  arithmetic without being on the seal path.
- **Consequence:** A golden test case (same inputs) is asserted in **both** pgTAP (against
  the RPC) and vitest (against the TS mirror); if they diverge, the mirror is the bug.

### ADR-6 — Logo in a private Storage bucket `org-branding`, signed-URL reads (mirror property-expense-receipts)

- **Decision:** A single **private** bucket `org-branding` (`public = false`). Logo objects
  keyed `{org_id}/logo-{uuid}-{sanitized_filename}`. `storage.objects` policies key on the
  first path segment = `org_id` and require `role = 'admin'`, with INSERT + SELECT + UPDATE
  + DELETE (upsert needs the first three together — Supabase gotcha). Reads via
  `createSignedUrl`, never `getPublicUrl`.
- **Rationale & the public-vs-private call:** A logo on an owner-facing PDF is genuinely
  low-sensitivity — a public bucket would not leak anything secret. **But we choose private
  anyway** to keep **one** Storage access convention across the product. Leg 1 established
  private + signed-URL + org-first-path for receipts; introducing a public-bucket special
  case here would mean two mental models, two policy shapes, and a standing "is this bucket
  public?" question on every future bucket. The cost of private is one `createSignedUrl`
  call at PDF-build time (the URL just needs to live long enough to fetch the image bytes
  into the PDF — TTL 60 s, same as receipts). Uniformity wins over a marginal convenience.
- **Rejected:** Public bucket + `getPublicUrl`. Rejected as default — saves one signed-URL
  call but forks the Storage convention; not worth it. (Documented as the deliberate
  alternative per the locked decision.)
- **Consequence:** The PDF document needs the **image bytes**, not just a URL — React-PDF
  `<Image src=...>` accepts a URL or a data URI. We fetch the signed URL → blob → data URI
  (or pass the signed URL directly if CORS allows) at build time. See §6.3.

### ADR-7 — Seal-once guard in the RPC

- **Decision:** The RPC refuses to seal any settlement row that already has a non-null
  `breakdown` (raises a clear exception, rolls back). A double-click on "Liquidar" cannot
  overwrite a frozen snapshot or re-stamp expenses.
- **Rationale:** Re-settling an already-sealed owner is out of scope (proposal). The seal is
  immutable; the cheapest enforcement is a guard at the only write path. Idempotency story
  mirrors the trigger's "already posted" check.

### ADR-8 — Co-locate: profile under new `src/features/agency-profile/`, PDF under `src/features/caja/`

- **Decision:** The agency-profile settings UI lives in a **new** feature folder
  `src/features/agency-profile/`. The PDF document, the settlement-statement data hook, and
  the download/share wiring live under the **existing** `src/features/caja/` (the
  Liquidaciones tab is the launch point).
- **Rationale:** Agency profile is its own bounded entity (its own table, RLS, lifecycle,
  settings surface) — a sibling feature, mirroring how `property-expenses` sits beside
  `caja`. The PDF is intrinsically part of the settlement/liquidación flow, so it belongs
  with `caja` next to `use-settle-owner` / `use-owner-settlements`.

---

## 2. Database — DDL

All in schema `nodo_inmo`. Reuses `nodo_inmo.set_updated_at()` (from the properties
migration). No new extensions. Two migrations, matching the PR split (PR-A migration is
independent of PR-B migration):

### 2.1 PR-A — `nodo_inmo.org_profiles`

```sql
create table nodo_inmo.org_profiles (
  org_id      uuid          primary key
                            references shared.organizations(id)
                            on delete cascade,
  legal_name  text,                 -- razón social on the comprobante (nullable: graceful first-run)
  address     text,                 -- domicilio
  cuit        text,                 -- fiscal id; format validated client-side, stored as text
  phone       text,
  email       text,
  logo_path   text,                 -- storage object key in `org-branding`; nullable
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default clock_timestamp()
);

create trigger set_updated_at
  before update on nodo_inmo.org_profiles
  for each row
  execute function nodo_inmo.set_updated_at();
```

Design notes:
- `org_id` is **both PK and FK** → exactly one profile per org, enforced by the schema
  (ADR-1). No separate `id`.
- Every comprobante field is **nullable** — an org that has not filled its profile must
  still produce a usable PDF with graceful placeholders (proposal risk 5), never crash.
- `cuit` stored as `text` (preserves leading zeros / hyphen formatting); format is a
  client-side zod concern, not a DB check (keeps the row writable during partial setup).
- No `org_id` index needed — it is the PK.

### 2.2 PR-B — `owner_settlements.breakdown` + `settlement_group` + `property_expenses.applied_settlement_id`

```sql
-- Breakdown snapshot (ADR-3) + liquidación grouping key.
alter table nodo_inmo.owner_settlements
  add column breakdown        jsonb,   -- frozen money story; null = not yet sealed
  add column settlement_group uuid;    -- shared id across the rows of one liquidación

-- Consumed marker (ADR-4): which settlement absorbed this expense as a deduction.
alter table nodo_inmo.property_expenses
  add column applied_settlement_id uuid
    references nodo_inmo.owner_settlements(id)
    on delete set null;

-- Hot path: the deduction query filters unconsumed chargeable rows. Partial index
-- keeps it tiny (only rows still available to a future settlement).
create index property_expenses_unapplied_idx
  on nodo_inmo.property_expenses (org_id, currency)
  where applied_settlement_id is null and charged_to_owner = true;

-- Fetch "the liquidación" (all rows sharing a group) for the PDF.
create index owner_settlements_group_idx
  on nodo_inmo.owner_settlements (settlement_group)
  where settlement_group is not null;
```

Design notes:
- `breakdown` nullable — pending (unsealed) rows have `null`; the seal-once guard (ADR-7)
  keys on it.
- `settlement_group` is **not** an FK — it is a correlation id minted by the RPC per
  liquidación, written identically across the batch's rows (ADR-3). Nullable for the
  historical rows that predate this change.
- `applied_settlement_id` `on delete set null` (ADR-4) — deleting a settlement frees its
  expenses, never deletes the receipt.
- The partial `property_expenses_unapplied_idx` directly serves the RPC's deduction
  SELECT; `charged_to_owner = true and applied_settlement_id is null` is the selective
  predicate, `(org_id, currency)` the equality keys.

### 2.3 PR-B — the `settle_owner` RPC (the atomic seal — HEADLINE-1, ADR-2/3/4/5/7)

Signature:

```sql
create or replace function nodo_inmo.settle_owner(
  p_owner_id        uuid,
  p_currency        text,
  p_settlement_ids  uuid[]
) returns jsonb            -- returns the sealed breakdown (so the client can render immediately)
  language plpgsql
  security invoker          -- runs under the caller's RLS (ADR-2)
  set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_group         uuid := gen_random_uuid();
  v_anchor_id     uuid;
  v_gross         numeric(15,2);
  v_commission    numeric(15,2);
  v_rate          numeric(5,2);
  v_net_owner     numeric(15,2);   -- sum of owner_settlements.amount (gross - commission, per cobro)
  v_deductions    jsonb;
  v_deduction_sum numeric(15,2);
  v_net           numeric(15,2);
  v_today         date := current_date;
  v_breakdown     jsonb;
begin
  -- 0. Resolve + authorize. Defense-in-depth on top of RLS (ADR-2).
  v_org_id := ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid;
  if (select auth.jwt()) -> 'app_metadata' ->> 'role' <> 'admin' then
    raise exception 'settle_owner: admin role required';
  end if;
  if p_settlement_ids is null or cardinality(p_settlement_ids) = 0 then
    raise exception 'settle_owner: no settlements provided';
  end if;

  -- 1. Lock the target rows; validate they belong to this owner+currency+org, are pending,
  --    and (seal-once, ADR-7) not already sealed.
  perform 1
  from nodo_inmo.owner_settlements s
  where s.id = any(p_settlement_ids)
    and s.org_id = v_org_id
    and s.owner_id = p_owner_id
    and s.currency = p_currency
    and s.status = 'pending'
    and s.breakdown is null
  for update;
  if (select count(*) from nodo_inmo.owner_settlements s
        where s.id = any(p_settlement_ids) and s.status = 'pending'
          and s.breakdown is null) <> cardinality(p_settlement_ids) then
    raise exception 'settle_owner: some settlements are missing, already settled, or already sealed';
  end if;

  v_anchor_id := (select min(id) from nodo_inmo.owner_settlements where id = any(p_settlement_ids));

  -- 2. GROSS + COMMISSION (canonical compute — HEADLINE-2).
  --    Net-to-owner is the sum of the settlement rows' amount (already gross - commission per cobro).
  --    Gross = the underlying payments' amount; commission = the commission cash_movements
  --    posted for those same payments (the immutable as-of-cobro figure, not a live rate recompute).
  select coalesce(sum(s.amount), 0)
    into v_net_owner
  from nodo_inmo.owner_settlements s
  where s.id = any(p_settlement_ids);

  select coalesce(sum(pm.amount), 0)
    into v_gross
  from nodo_inmo.owner_settlements s
  join nodo_inmo.payments pm on pm.id = s.payment_id
  where s.id = any(p_settlement_ids);

  select coalesce(sum(cm.amount), 0)
    into v_commission
  from nodo_inmo.owner_settlements s
  join nodo_inmo.cash_movements cm
    on cm.payment_id = s.payment_id and cm.source = 'commission'
  where s.id = any(p_settlement_ids);

  -- Effective rate for display (frozen): commission / gross. Guard divide-by-zero.
  v_rate := case when v_gross > 0 then round(v_commission / v_gross * 100, 2) else 0 end;

  -- 3. DEDUCTIONS: this owner's unconsumed chargeable expenses in this currency.
  --    Resolved through the security_invoker view (owner derived via property join).
  --    Lock them so a concurrent settle can't grab the same rows.
  with picked as (
    select e.id, e.amount, e.description, e.expense_date, e.type
    from nodo_inmo.property_expenses e
    join nodo_inmo.properties p on p.id = e.property_id
    where p.owner_id = p_owner_id
      and e.org_id = v_org_id
      and e.currency = p_currency
      and e.charged_to_owner = true
      and e.applied_settlement_id is null
    for update of e
  )
  select
    coalesce(sum(amount), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'expense_id',  id,
      'amount',      amount,
      'description', description,
      'expense_date', expense_date,
      'type',        type
    ) order by expense_date), '[]'::jsonb)
  into v_deduction_sum, v_deductions
  from picked;

  -- 4. NET = owner share (gross - commission) - deductions.
  v_net := v_net_owner - v_deduction_sum;

  -- 5. Assemble the frozen breakdown document (the exact shape the PDF renders).
  v_breakdown := jsonb_build_object(
    'version',          1,
    'currency',         p_currency,
    'gross',            v_gross,
    'commission_rate',  v_rate,
    'commission',       v_commission,
    'owner_share',      v_net_owner,
    'deductions',       v_deductions,
    'deduction_total',  v_deduction_sum,
    'net',              v_net,
    'settlement_group', v_group,
    'sealed_at',        now(),
    'cobro_count',      cardinality(p_settlement_ids)
  );

  -- 6. ATOMIC SEAL (all three writes in this one transaction — HEADLINE-1):
  -- 6a. Write snapshot + group + flip status on every row of the liquidación.
  update nodo_inmo.owner_settlements
     set status = 'settled',
         settled_date = v_today,
         breakdown = v_breakdown,
         settlement_group = v_group
   where id = any(p_settlement_ids);

  -- 6b. Stamp consumed expenses with the anchor settlement id (ADR-4).
  update nodo_inmo.property_expenses e
     set applied_settlement_id = v_anchor_id
   where e.org_id = v_org_id
     and exists (
       select 1 from nodo_inmo.properties p
       where p.id = e.property_id and p.owner_id = p_owner_id
     )
     and e.currency = p_currency
     and e.charged_to_owner = true
     and e.applied_settlement_id is null;

  return v_breakdown;
end;
$$;
```

RPC design notes:
- **One transaction (HEADLINE-1).** All SELECT-locks and both UPDATEs are in one function
  body → one transaction. A failure anywhere rolls the whole thing back; the next
  liquidación sees the expenses still `applied_settlement_id is null`.
- **`SECURITY INVOKER` + explicit admin/org checks (ADR-2).** RLS still gates every table
  touched; the explicit checks fail fast with a readable error instead of a confusing
  0-rows result.
- **`for update` locks** on both the settlement rows and the picked expenses prevent two
  concurrent settles of the same owner from racing into a double-count.
- **Seal-once (ADR-7)** enforced by the `breakdown is null` predicate + the count check in
  step 1.
- **Commission read as-of-cobro (HEADLINE-2 / drift mitigation).** Commission comes from
  the `cash_movements` rows posted by the trigger at cobro time — the frozen figure — not a
  live `contacts.commission_rate` recompute. `commission_rate` in the breakdown is the
  *effective* rate derived from those frozen amounts, for display only.
- **Returns the breakdown JSONB** so the client renders the PDF immediately without a
  re-fetch round-trip.
- `set search_path = ''` + fully-qualified names — mirrors `post_payment_to_caja`.

### 2.4 Breakdown JSONB schema (the frozen document — ADR-3)

```jsonc
{
  "version": 1,                       // schema version, for forward-compat in leg 3
  "currency": "ARS",
  "gross": 250000.00,                 // sum of underlying payments.amount
  "commission_rate": 10.00,           // effective % = commission/gross (display)
  "commission": 25000.00,             // sum of commission cash_movements (frozen as-of-cobro)
  "owner_share": 225000.00,           // gross - commission (sum of owner_settlements.amount)
  "deductions": [                     // consumed chargeable expenses
    {
      "expense_id": "uuid",
      "amount": 12000.00,
      "description": "Plomería depto 2B",
      "expense_date": "2026-05-14",
      "type": "arreglo"
    }
  ],
  "deduction_total": 12000.00,
  "net": 213000.00,                   // owner_share - deduction_total  (the headline figure)
  "settlement_group": "uuid",
  "sealed_at": "2026-06-04T12:00:00Z",
  "cobro_count": 2
}
```

Identity that must hold (asserted in tests): `net = gross − commission − deduction_total`.

---

## 3. RLS

### 3.1 `org_profiles` — Template B (admin-only)

Mirrors `create_caja.sql` exactly (InitPlan-friendly `(select auth.jwt())`, UPDATE with
both `USING` and `WITH CHECK`). The scoping column is `org_id` (the PK).

```sql
alter table nodo_inmo.org_profiles enable row level security;

create policy "admin_select" on nodo_inmo.org_profiles
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_insert" on nodo_inmo.org_profiles
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_update" on nodo_inmo.org_profiles
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "admin_delete" on nodo_inmo.org_profiles
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
```

The foundation migration's default-privilege grant already makes the table reachable by
`authenticated`; RLS gates it to admins. No extra `grant` (matches the caja note).

The profile UI **upsert** uses `.upsert(..., { onConflict: "org_id" })`. Upsert under RLS
needs both INSERT (`WITH CHECK`) and UPDATE (`USING`+`WITH CHECK`) + SELECT policies — all
four present above.

### 3.2 `owner_settlements` / `property_expenses` — already Template B

No RLS changes in PR-B. The new columns inherit the existing Template B policies (RLS is
row-level, not column-level). The `settle_owner` RPC runs `SECURITY INVOKER` so those same
policies gate it.

---

## 4. Storage — private bucket `org-branding` (mirror property-expense-receipts)

### 4.1 Bucket

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-branding', 'org-branding', false,
  2097152,  -- 2 MiB cap; a logo is small
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;
```

> SVG note: React-PDF `<Image>` does **not** render SVG; if SVG is accepted for storage we
> still rasterize/skip it for the PDF, or restrict to raster only. **Decision: restrict to
> raster** (`image/jpeg`, `image/png`, `image/webp`) to avoid a logo that uploads fine but
> never renders on the comprobante. Drop `image/svg+xml` from the list above. The UI file
> input enforces the same.

`config.toml` (local dev provisioning, mirrors the receipts block):

```toml
[storage.buckets.org-branding]
public = false
file_size_limit = "2MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]
```

### 4.2 Path convention

```
org-branding/{org_id}/logo-{uuid}-{sanitized_filename}
```

Leading `{org_id}` segment is what the RLS policies key on (`storage.objects` has no
`org_id` column). One logical logo per org, but `{uuid}` prefix allows clean replace
(upsert) without stale-cache surprises.

### 4.3 `storage.objects` policies — INSERT + SELECT + UPDATE + DELETE (admin-only, org-scoped)

Identical shape to the `receipts_admin_*` policies, renamed `branding_admin_*` and scoped
to `bucket_id = 'org-branding'`. INSERT + SELECT + UPDATE required together for upsert;
DELETE lets an admin clear a wrong logo.

```sql
create policy "branding_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "branding_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "branding_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "branding_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
```

### 4.4 Client upload + retrieval (reuse leg-1 patterns verbatim)

- **Upload** (`useUploadLogo`) mirrors `useUploadReceipt`: key =
  `${orgId}/logo-${crypto.randomUUID()}-${sanitize(file.name)}`,
  `supabase.storage.from('org-branding').upload(key, file, { upsert: true })`, return the
  `path`. The profile upsert stores it in `org_profiles.logo_path`.
- **Retrieval** (`useLogoUrl`) mirrors `useReceiptUrl`: `createSignedUrl(logo_path, 60)`,
  `enabled: !!logo_path`, `staleTime: 0`. Never `getPublicUrl`.

---

## 5. Frontend — agency profile (PR-A) — `src/features/agency-profile/`

```
src/features/agency-profile/
  hooks/
    use-org-profile.ts          # query: select * from org_profiles where org_id = me (single row)
    use-upsert-org-profile.ts   # mutation: upsert { org_id, ...fields }, onConflict org_id
    use-upload-logo.ts          # storage upload → object key (mirrors use-upload-receipt)
    use-logo-url.ts             # createSignedUrl on demand (mirrors use-receipt-url)
  components/
    agency-profile-form.tsx     # react-hook-form + zod; logo file input + signed-URL preview
  __tests__/
    agency-profile-form.test.tsx
```

- **Surface / entry point.** A "Datos de la agencia" / Configuración section, admin-only
  (gated on `role === 'admin'` from `useAuth` — UI mirror of the RLS gate). Reachable from
  the same place the existing `ProfileDialog` ("Mi perfil") is launched. Tasks fixes the
  exact menu wiring; the design contract is "admin-only settings surface".
- **Form pattern** mirrors `profile-dialog.tsx` and `expense-form-dialog.tsx`: `useForm` +
  `zodResolver`, shadcn `Form/FormField/Input`, a native file `<input>` for the logo, a
  signed-URL `<img>` preview of the current logo. Zod schema:

```ts
const schema = z.object({
  legal_name: z.string().optional(),
  address: z.string().optional(),
  cuit: z.string().optional()
    .refine((v) => !v || /^\d{2}-?\d{8}-?\d$/.test(v), "CUIT inválido"),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  logo: z.instanceof(File).optional(),
});
```

  All fields optional (graceful first-run, ADR-1). On submit: if a `logo` File is present,
  upload it first → get key, then `upsert` the profile with `logo_path = key`; else upsert
  without touching `logo_path`. Best-effort delete of a just-uploaded object if the upsert
  fails (mirrors the receipt orphan-cleanup note).

- **`use-upsert-org-profile.ts`** mirrors `use-create-expense.ts`: injects `org_id` from
  `useAuth`, throws if absent, `.upsert({ ...input, org_id: orgId }, { onConflict: "org_id" })`,
  invalidates `ORG_PROFILE_QUERY_KEY` on success.

---

## 6. Frontend — sealing wiring (PR-B) + PDF & share (PR-C) — `src/features/caja/`

### 6.1 Extended settle flow (PR-B)

`use-settle-owner.ts` changes from a direct `.update()` to a single RPC call:

```ts
const { data, error } = await supabase
  .schema("nodo_inmo")
  .rpc("settle_owner", {
    p_owner_id: input.owner_id,
    p_currency: input.currency,
    p_settlement_ids: input.settlement_ids,
  });
if (error) throw error;
return data; // the sealed breakdown JSONB — fed straight to the PDF in PR-C
```

`onSuccess` invalidates `OWNER_SETTLEMENTS_QUERY_KEY` (unchanged). `SettleOwnerInput` keeps
its current shape (`owner_id`, `currency`, `settlement_ids`, plus `owner_name`/`total` for
the UI). The mutation now **returns the breakdown**, which `caja-page` hands to the PDF.

`caja-math.ts` gains the pure `computeSettlementBreakdown()` (ADR-5, display/mirror only):

```ts
export interface BreakdownDeduction {
  expense_id: string; amount: number; description: string;
  expense_date: string; type: string;
}
export interface SettlementBreakdown {
  version: number; currency: string;
  gross: number; commission_rate: number; commission: number;
  owner_share: number; deductions: BreakdownDeduction[];
  deduction_total: number; net: number;
  settlement_group?: string; sealed_at?: string; cobro_count: number;
}
/** Pure projection used for pre-seal display and as the vitest mirror of the SQL seal. */
export function computeSettlementBreakdown(input: {
  currency: string;
  payments: { amount: number }[];
  commissions: { amount: number }[];
  ownerShares: { amount: number }[];
  deductions: BreakdownDeduction[];
}): SettlementBreakdown { /* gross/commission/owner_share/deduction_total/net */ }
```

### 6.2 Data-loading hook — `use-settlement-statement.ts` (PR-C)

```
src/features/caja/hooks/use-settlement-statement.ts
```

Assembles everything the PDF needs, in **parallel** (no waterfall — Vercel `async-parallel`):
1. the **sealed breakdown** — either the value the RPC just returned (post-seal), or, for a
   reprint, `owner_settlements` filtered by `settlement_group` (one row carries the
   aggregate `breakdown`);
2. the **agency profile** via `use-org-profile` (+ `use-logo-url` for the signed logo URL);
3. the **owner name** (already embedded in `useOwnerSettlements`).

Returns `{ breakdown, agency, logoUrl, owner }`. The logo bytes are fetched from the signed
URL → data URI at build time (ADR-6 consequence) so React-PDF can embed them.

### 6.3 PDF document — `settlement-statement-document.tsx` (PR-C)

```
src/features/caja/components/settlement-statement-document.tsx
```

- **Dynamic import only.** `@react-pdf/renderer` (~300 KB) is **never** statically imported
  in the admin bundle (Vercel `bundle-dynamic-imports`; proposal risk 3). The document
  module and the `pdf()` builder are loaded via `await import("@react-pdf/renderer")` and
  `await import("./settlement-statement-document")` **inside the download/share handler**,
  so the cost is paid only when an admin actually generates a comprobante.
- **Component structure** (`Document > Page > View` tree, React-PDF primitives + `StyleSheet`):
  - **Header band** — agency `<Image src={logoDataUri}>` (omitted gracefully if no logo),
    `legal_name`, `address`, `cuit`, `phone`/`email`. Placeholders ("—") when the profile
    is empty (proposal risk 5).
  - **Title + meta** — "Comprobante de liquidación", owner name, `sealed_at` date, currency.
  - **Breakdown table** — rows: Gross (bruto cobrado), Commission (− comisión, with
    effective rate), Owner share (subtotal), each Deduction line (− description / date /
    amount), Deduction total, and a bold **Net (Neto a liquidar)** footer. Money formatted
    with the existing `formatMoney(amount, currency)` from `contract-labels`.
  - **Footer** — generated-on timestamp, optional disclaimer.
- **Inputs:** the `{ breakdown, agency, logoUrl|logoDataUri, owner }` from
  `use-settlement-statement`. The component is **pure presentational** — it renders the
  frozen `breakdown` verbatim (HEADLINE-2), no recomputation.

### 6.4 Download + share wiring in `caja-page.tsx` (PR-C)

The Liquidaciones tab gains, per owner group / per just-sealed liquidación, two actions
(after "Liquidar" succeeds, or on a sealed row): **Descargar** and **Compartir**.

```ts
async function buildBlob(data: StatementData): Promise<Blob> {
  const [{ pdf }, { SettlementStatementDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./settlement-statement-document"),
  ]);
  return pdf(<SettlementStatementDocument {...data} />).toBlob();
}

async function handleDownload(data: StatementData) {
  const blob = await buildBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liquidacion-${data.owner.name}-${data.breakdown.currency}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleShare(data: StatementData) {
  const blob = await buildBlob(data);
  const file = new File([blob], `liquidacion-${data.owner.name}.pdf`,
    { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Liquidación" });
  } else {
    await handleDownload(data); // graceful desktop fallback
  }
}
```

- **Web Share API** (`navigator.share({ files })`) for mobile (WhatsApp et al.), gated by
  `navigator.canShare({ files })` so desktop falls back to download — zero extra infra.
- **Multi-currency:** the Liquidaciones tab already groups by `owner_id:currency`
  (`groupPendingByOwner`); each group seals + renders independently → one PDF per owner per
  currency. The seal and the UI must never merge currencies (the key is the boundary).

---

## 7. Types — `database.ts` regeneration

`src/shared/types/database.ts` is generated. After each migration is committed, regenerate
with the project's existing flow (`supabase gen types typescript --local` → write to
`src/shared/types/database.ts`). This adds: `org_profiles` Row/Insert/Update (PR-A); the
`breakdown jsonb` + `settlement_group` columns on `owner_settlements` and
`applied_settlement_id` on `property_expenses` (PR-B); and the `settle_owner` function in
`Database["nodo_inmo"]["Functions"]` (PR-B). Hooks import these generated types — no
hand-written DB types. The `breakdown` JSONB is typed `Json` by the generator; the app
casts it to the `SettlementBreakdown` interface (§6.1) at the read boundary.

---

## 8. Testing strategy (Strict TDD active — RED first)

### 8.1 pgTAP — PR-A: `supabase/tests/150_org_profiles.test.sql`

Style mirrors `120_caja.test.sql` (`begin; select plan(N); … select * from finish();
rollback;`), seeding one org + admin + agent.
- `has_table`, `col_is_pk(...'org_id'...)`, FK to `shared.organizations`.
- RLS Template B: agent sees 0 rows / INSERT blocked (`throws_ok`); admin can SELECT /
  INSERT / UPDATE; `throws_ok` on reassigning `org_id` (WITH CHECK).
- Storage: `is((select public from storage.buckets where id = 'org-branding'), false)`;
  `has_policy`/`policies_are` for the four `branding_admin_*` policies.

### 8.2 pgTAP — PR-B: `supabase/tests/160_settle_owner.test.sql` (the critical one)

Seeds org + admin + owner (with `commission_rate`) + property + contract + two paid
payments (so the trigger has already posted commission + two pending settlements) + two
`charged_to_owner = true` expenses (one matching currency, one other-currency) + one
`charged_to_owner = false` expense.

Assertions (the invariants from §0):
- **Atomic seal / golden case.** Call `settle_owner(owner, 'ARS', [ids])`; assert the
  returned + persisted `breakdown` has the expected `gross`, `commission`, `owner_share`,
  `deduction_total`, and `net`, and that `net = gross − commission − deduction_total`.
- **No double-count (HEADLINE-1).** After the first seal, the matching-currency expense has
  `applied_settlement_id` set; a **second** `settle_owner` for the same owner sees **zero**
  unconsumed expenses (the deduction list is empty / `deduction_total = 0`). This is the
  headline correctness test.
- **Currency boundary.** The other-currency expense is **not** consumed by an ARS seal
  (`applied_settlement_id` stays null); a USD seal consumes it.
- **`charged_to_owner = false` never consumed.**
- **Seal-once (ADR-7).** Re-calling `settle_owner` on already-sealed ids `throws_ok`
  (refuses to overwrite the frozen snapshot); `breakdown` unchanged.
- **Atomicity under failure.** Force a failure mid-seal (e.g. an invalid id mixed into the
  batch) → assert **nothing** changed: no `breakdown`, no `applied_settlement_id`, status
  still `pending` (rollback proven).
- **RLS / authorization.** As agent (or wrong org) → `settle_owner` `throws_ok` / affects 0
  rows; as admin of another org → cannot seal this org's settlements.
- **Status + group.** All batch rows flip to `settled` with the shared `settlement_group`.

Column/shape checks: `has_column owner_settlements.breakdown` (jsonb),
`owner_settlements.settlement_group`, `property_expenses.applied_settlement_id` (FK), and
the two new partial indexes (`has_index`).

### 8.3 Storage cross-tenant integration (mirror leg-1)

Extend the existing `supabase/tests/integration/storage-cross-tenant.integration.test.ts`
pattern (run via `npm run test:integration`) to cover `org-branding`: admin of org A
uploads a logo; admin of org B cannot `createSignedUrl` org A's key; public URL exposes
nothing. (Signed-URL cross-tenant cannot be pure pgTAP — same caveat as receipts.)

### 8.4 vitest — PR-B compute mirror: `src/features/caja/__tests__/caja-math.test.ts`

- `computeSettlementBreakdown()` golden case = the **same inputs/outputs** as the pgTAP
  golden case (ADR-5 anti-drift): gross/commission/owner_share/deduction_total/net.
- Edge: zero deductions → `net = owner_share`; zero gross → `commission_rate = 0` (no
  divide-by-zero); multi-deduction sum.

### 8.5 vitest — PR-A form: `src/features/agency-profile/__tests__/agency-profile-form.test.tsx`

Mirrors `profile-dialog.test.tsx` / `create-property.test.tsx` (mock `supabase`, `useAuth`,
mutation hooks): renders all fields; validates CUIT/email; on submit with a logo File calls
upload then upsert with `org_id` + `logo_path`; without a file upserts without `logo_path`;
calls `onSuccess`.

### 8.6 vitest — PR-C PDF + share: `src/features/caja/__tests__/settlement-statement.test.tsx`

- **PDF document** is pure/presentational — render it (or its prop-mapping) against a fixed
  `breakdown` fixture and assert the money rows + the bold **net**; assert graceful
  placeholders when the agency profile is empty (proposal risk 5). (`@react-pdf/renderer`
  primitives render in jsdom for structure assertions; if not, test the prop-builder /
  data-mapping pure function instead and snapshot the React tree.)
- **Share** — mock `navigator.canShare`/`navigator.share`: when `canShare({files})` true →
  `navigator.share` called with a PDF `File`; when false → falls back to download
  (object-URL path). Mock the dynamic `import()` of `@react-pdf/renderer`.
- **Dynamic-import guard** — assert (lint/review + a test that the module is imported
  lazily) that `@react-pdf/renderer` is not in the static admin import graph.

Strict-TDD feasibility: every layer (profile table+RLS, RPC seal+no-double-count+rollback,
compute mirror, profile form, PDF+share) has an assertion that fails before implementation,
so all tests can be written RED first.

---

## 9. Migration & commit flow

Per PR (matches `create_property_expenses` provenance):
1. Iterate schema with MCP `execute_sql` (no migration-history churn) — table/columns,
   indexes, trigger, RLS, bucket, storage policies, **and the `settle_owner` function**.
2. Run `supabase db advisors` / MCP `get_advisors`; fix findings (expect checks on the
   function's `security invoker` + `search_path`, on storage policies, and on the new
   indexes).
3. `supabase db pull <name> --local --yes` → migration file (`create_org_profiles` for
   PR-A; `settle_owner_breakdown` for PR-B). Do **not** hand-author the filename.
4. `supabase migration list --local` to verify.
5. Regenerate `src/shared/types/database.ts`.
6. Add the pgTAP test files (`150_…`, `160_…`).

---

## 10. PR split (confirms proposal Delivery — chained PRs)

| PR | Scope | Depends on | Rough boundary |
|----|-------|-----------|----------------|
| **PR-A — Agency profile** | `org_profiles` migration + Template B RLS + `org-branding` bucket/policies + `config.toml` + `src/features/agency-profile/` (hooks, form, settings entry) + pgTAP `150` + storage integration + vitest form | nothing | Self-contained "fill the letterhead" capability. ~migration + 4 hooks + 1 form + 2 test files. |
| **PR-B — Breakdown sealing** | `breakdown`/`settlement_group`/`applied_settlement_id` migration + 2 partial indexes + **`settle_owner` RPC** + `computeSettlementBreakdown()` + RPC-based `use-settle-owner` + types regen + pgTAP `160` + vitest compute | nothing in A | The atomic seal. Migration + RPC + 1 hook rewrite + 1 pure fn + 2 test files. Highest-risk PR (the money invariant). |
| **PR-C — PDF comprobante + share** | `@react-pdf/renderer` dep + `settlement-statement-document.tsx` + `use-settlement-statement.ts` + download/share wiring in `caja-page.tsx` + vitest PDF/share | **A** (branding) **and B** (breakdown) | Compose + emit. New PDF component + 1 hook + caja-page wiring + 1 test file. Dynamic-import discipline is the review gate. |

A and B are independent and can be built in parallel; C integrates last. Each PR is
independently shippable and within a normal review budget. `sdd-tasks` produces the final
ordered task list and the size forecast per PR.

---

## 11. Security checklist (run before committing each PR)

PR-A:
- [ ] RLS enabled on `nodo_inmo.org_profiles`; four Template B policies present; UPDATE has
      `USING` + `WITH CHECK`.
- [ ] No policy reads `user_metadata` (all `app_metadata`).
- [ ] Bucket `org-branding` is `public = false`; raster-only MIME list.
- [ ] `storage.objects` has INSERT + SELECT + UPDATE + DELETE `branding_admin_*` policies,
      each scoped by `bucket_id`, first-folder `org_id`, `role = 'admin'`.
- [ ] Manual/integration cross-tenant signed-URL read denied.

PR-B:
- [ ] `settle_owner` is `SECURITY INVOKER` (NOT definer) with `set search_path = ''` and
      fully-qualified names.
- [ ] Function self-checks `role = 'admin'` and `org_id`; relies on RLS for row gating.
- [ ] Seal-once guard present; `for update` locks present.
- [ ] `applied_settlement_id` FK is `on delete set null`.
- [ ] pgTAP proves: golden breakdown, **no double-count on second seal**, currency
      boundary, seal-once refusal, and **rollback on mid-seal failure**.
- [ ] `supabase db advisors` clean.

PR-C:
- [ ] `@react-pdf/renderer` is dynamically imported only (never in the static admin graph).
- [ ] PDF reads the frozen `breakdown` verbatim — no recomputation (HEADLINE-2).
- [ ] Empty-profile renders graceful placeholders, does not crash.
