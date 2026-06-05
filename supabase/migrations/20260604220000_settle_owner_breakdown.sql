-- PR-B: Breakdown sealing — schema extensions + settle_owner RPC
--
-- 1. owner_settlements.breakdown (jsonb, nullable) + settlement_group (uuid, nullable)
-- 2. property_expenses.applied_settlement_id (uuid FK → owner_settlements, on delete set null)
-- 3. Two partial indexes (deduction hot-path + group fetch)
-- 4. Updated post_payment_to_caja trigger: commission_rate = coalesce(properties.commission_rate, contacts.commission_rate)
-- 5. settle_owner RPC: SECURITY INVOKER, atomic seal (HEADLINE-1, ADR-2/3/4/5/7)
--
-- Apply locally with:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/migrations/20260604220000_settle_owner_breakdown.sql

-- ---------------------------------------------------------------------------
-- 1. Column additions on owner_settlements
-- ---------------------------------------------------------------------------
alter table nodo_inmo.owner_settlements
  add column breakdown        jsonb,
  add column settlement_group uuid;

-- ---------------------------------------------------------------------------
-- 2. Column addition on property_expenses
-- ---------------------------------------------------------------------------
alter table nodo_inmo.property_expenses
  add column applied_settlement_id uuid
    references nodo_inmo.owner_settlements(id)
    on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Hot path: deduction query filters unconsumed chargeable rows.
-- Partial index keeps it tiny (only rows still available to a future settlement).
create index property_expenses_unapplied_idx
  on nodo_inmo.property_expenses (org_id, currency)
  where applied_settlement_id is null and charged_to_owner = true;

-- Fetch "the liquidación" (all rows sharing a group) for the PDF.
create index owner_settlements_group_idx
  on nodo_inmo.owner_settlements (settlement_group)
  where settlement_group is not null;

-- ---------------------------------------------------------------------------
-- 4. Updated post_payment_to_caja trigger
--    Commission rule: coalesce(properties.commission_rate, contacts.commission_rate)
--    (property-first; contact is fallback if property rate is NULL)
-- ---------------------------------------------------------------------------
create or replace function nodo_inmo.post_payment_to_caja()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_owner_id    uuid;
  v_rate        numeric;
  v_commission  numeric;
  v_owner_share numeric;
  v_label       text;
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    v_label := to_char(new.period, 'MM/YYYY');

    -- Commission rule: property commission_rate first, fallback to contact's rate.
    select p.owner_id,
           coalesce(p.commission_rate, coalesce(ct.commission_rate, 0))
      into v_owner_id, v_rate
    from nodo_inmo.contracts k
    join nodo_inmo.properties p on p.id = k.property_id
    left join nodo_inmo.contacts ct on ct.id = p.owner_id
    where k.id = new.contract_id;

    if v_owner_id is not null then
      v_commission  := round(new.amount * v_rate / 100, 2);
      v_owner_share := new.amount - v_commission;

      if not exists (
        select 1 from nodo_inmo.cash_movements
        where payment_id = new.id and source = 'commission'
      ) then
        insert into nodo_inmo.cash_movements
          (org_id, type, amount, currency, date, concept, source, payment_id)
        values
          (new.org_id, 'income', v_commission, new.currency,
           coalesce(new.paid_date, current_date),
           'Comisión cobro ' || v_label, 'commission', new.id);
      end if;

      insert into nodo_inmo.owner_settlements
        (org_id, owner_id, payment_id, amount, currency, status)
      values
        (new.org_id, v_owner_id, new.id, v_owner_share, new.currency, 'pending')
      on conflict (payment_id) do nothing;
    else
      -- No owner on the property: the whole cobro is agency income.
      if not exists (
        select 1 from nodo_inmo.cash_movements where payment_id = new.id
      ) then
        insert into nodo_inmo.cash_movements
          (org_id, type, amount, currency, date, concept, source, payment_id)
        values
          (new.org_id, 'income', new.amount, new.currency,
           coalesce(new.paid_date, current_date),
           'Cobro alquiler ' || v_label, 'commission', new.id);
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. settle_owner RPC
--    SECURITY INVOKER: runs under caller's RLS (ADR-2).
--    One transaction = one function body (HEADLINE-1).
--    set search_path = '' + fully-qualified names (mirrors post_payment_to_caja).
-- ---------------------------------------------------------------------------
create or replace function nodo_inmo.settle_owner(
  p_owner_id        uuid,
  p_currency        text,
  p_settlement_ids  uuid[]
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_group         uuid := gen_random_uuid();
  v_anchor_id     uuid;
  v_gross         numeric(15,2);
  v_commission    numeric(15,2);
  v_net_owner     numeric(15,2);
  v_rate          numeric(5,2);
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

  -- 1. Lock the target rows; validate they belong to this owner+currency+org,
  --    are pending, and are not already sealed (seal-once guard ADR-7).
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
        where s.id = any(p_settlement_ids)
          and s.org_id = v_org_id
          and s.owner_id = p_owner_id
          and s.currency = p_currency
          and s.status = 'pending'
          and s.breakdown is null) <> cardinality(p_settlement_ids) then
    raise exception 'settle_owner: some settlements are missing, already settled, or already sealed';
  end if;

  -- Anchor = first id when sorted lexicographically (deterministic; min(uuid) not supported)
  select id into v_anchor_id
  from nodo_inmo.owner_settlements
  where id = any(p_settlement_ids)
  order by id::text
  limit 1;

  -- 2. GROSS + COMMISSION (canonical compute — HEADLINE-2).
  --    owner_share = sum of the settlement rows' amounts (gross - commission per cobro).
  --    gross = the underlying payments' amounts.
  --    commission = the commission cash_movements posted at cobro time (frozen as-of-cobro).
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
  v_rate := case when v_gross > 0
    then round(v_commission / v_gross * 100, 2)
    else 0
  end;

  -- 3. DEDUCTIONS: this owner's unconsumed chargeable expenses in this currency.
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
    coalesce(
      jsonb_agg(jsonb_build_object(
        'expense_id',   id,
        'amount',       amount,
        'description',  description,
        'expense_date', expense_date,
        'type',         type
      ) order by expense_date),
      '[]'::jsonb
    )
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
     set status           = 'settled',
         settled_date     = v_today,
         breakdown        = v_breakdown,
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
