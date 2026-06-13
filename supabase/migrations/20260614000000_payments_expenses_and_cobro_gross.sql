-- Expensas/otros en cobros: se guardan en payments.expenses_amount y entran al bruto
-- para comisión y rendición (alquiler + expensas × % comisión del contrato).

alter table nodo_inmo.payments
  add column if not exists expenses_amount numeric(15,2) not null default 0
    check (expenses_amount >= 0);

-- Comisión sobre bruto = amount (alquiler) + expenses_amount.
-- Prioridad de tasa: contrato (commission_amount/rent_amount) → propiedad → contacto.
create or replace function nodo_inmo.post_payment_to_caja()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_owner_id    uuid;
  v_rate        numeric;
  v_gross       numeric;
  v_commission  numeric;
  v_owner_share numeric;
  v_label       text;
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    v_label := to_char(new.period, 'MM/YYYY');
    v_gross := new.amount + coalesce(new.expenses_amount, 0);

    select p.owner_id,
           coalesce(
             case
               when k.rent_amount > 0 and k.commission_amount is not null
               then round(k.commission_amount / k.rent_amount * 100, 2)
               else null
             end,
             p.commission_rate,
             coalesce(ct.commission_rate, 0)
           )
      into v_owner_id, v_rate
    from nodo_inmo.contracts k
    join nodo_inmo.properties p on p.id = k.property_id
    left join nodo_inmo.contacts ct on ct.id = p.owner_id
    where k.id = new.contract_id;

    if v_owner_id is not null then
      v_commission  := round(v_gross * v_rate / 100, 2);
      v_owner_share := v_gross - v_commission;

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
      if not exists (
        select 1 from nodo_inmo.cash_movements where payment_id = new.id
      ) then
        insert into nodo_inmo.cash_movements
          (org_id, type, amount, currency, date, concept, source, payment_id)
        values
          (new.org_id, 'income', v_gross, new.currency,
           coalesce(new.paid_date, current_date),
           'Cobro alquiler ' || v_label, 'commission', new.id);
      end if;
    end if;

  elsif new.status = 'paid' and old.status = 'paid'
    and (
      new.amount is distinct from old.amount
      or coalesce(new.expenses_amount, 0) is distinct from coalesce(old.expenses_amount, 0)
    ) then
    v_gross := new.amount + coalesce(new.expenses_amount, 0);

    select p.owner_id,
           coalesce(
             case
               when k.rent_amount > 0 and k.commission_amount is not null
               then round(k.commission_amount / k.rent_amount * 100, 2)
               else null
             end,
             p.commission_rate,
             coalesce(ct.commission_rate, 0)
           )
      into v_owner_id, v_rate
    from nodo_inmo.contracts k
    join nodo_inmo.properties p on p.id = k.property_id
    left join nodo_inmo.contacts ct on ct.id = p.owner_id
    where k.id = new.contract_id;

    if v_owner_id is not null then
      v_commission  := round(v_gross * v_rate / 100, 2);
      v_owner_share := v_gross - v_commission;

      update nodo_inmo.cash_movements
      set amount = v_commission
      where payment_id = new.id and source = 'commission';

      update nodo_inmo.owner_settlements
      set amount = v_owner_share
      where payment_id = new.id
        and status = 'pending'
        and breakdown is null;
    else
      update nodo_inmo.cash_movements
      set amount = v_gross
      where payment_id = new.id and source = 'commission';
    end if;
  end if;

  return new;
end;
$$;

-- settle_owner: bruto incluye expensas cobradas junto al alquiler.
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
  v_org_id          uuid;
  v_group           uuid := gen_random_uuid();
  v_anchor_id       uuid;
  v_gross           numeric(15,2);
  v_rent_gross      numeric(15,2);
  v_expenses_gross  numeric(15,2);
  v_commission      numeric(15,2);
  v_net_owner       numeric(15,2);
  v_rate            numeric(5,2);
  v_deductions      jsonb;
  v_deduction_sum   numeric(15,2);
  v_net             numeric(15,2);
  v_today           date := current_date;
  v_breakdown       jsonb;
begin
  v_org_id := ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid;
  if (select auth.jwt()) -> 'app_metadata' ->> 'role' <> 'admin' then
    raise exception 'settle_owner: admin role required';
  end if;
  if p_settlement_ids is null or cardinality(p_settlement_ids) = 0 then
    raise exception 'settle_owner: no settlements provided';
  end if;

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

  select id into v_anchor_id
  from nodo_inmo.owner_settlements
  where id = any(p_settlement_ids)
  order by id::text
  limit 1;

  select coalesce(sum(s.amount), 0)
    into v_net_owner
  from nodo_inmo.owner_settlements s
  where s.id = any(p_settlement_ids);

  select
    coalesce(sum(pm.amount), 0),
    coalesce(sum(coalesce(pm.expenses_amount, 0)), 0)
    into v_rent_gross, v_expenses_gross
  from nodo_inmo.owner_settlements s
  join nodo_inmo.payments pm on pm.id = s.payment_id
  where s.id = any(p_settlement_ids);

  v_gross := v_rent_gross + v_expenses_gross;

  select coalesce(sum(cm.amount), 0)
    into v_commission
  from nodo_inmo.owner_settlements s
  join nodo_inmo.cash_movements cm
    on cm.payment_id = s.payment_id and cm.source = 'commission'
  where s.id = any(p_settlement_ids);

  v_rate := case when v_gross > 0
    then round(v_commission / v_gross * 100, 2)
    else 0
  end;

  with picked as (
    select e.id, e.amount, e.description, e.expense_date, e.type
    from nodo_inmo.property_expenses e
    join nodo_inmo.properties p on p.id = e.property_id and p.org_id = v_org_id
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
        'id',           id,
        'amount',       amount,
        'description',  description,
        'expense_date', expense_date,
        'type',         type
      ) order by expense_date),
      '[]'::jsonb
    )
  into v_deduction_sum, v_deductions
  from picked;

  v_net := v_net_owner - v_deduction_sum;

  v_breakdown := jsonb_build_object(
    'version',          1,
    'currency',         p_currency,
    'gross',            v_gross,
    'rent_gross',       v_rent_gross,
    'expenses_gross',   v_expenses_gross,
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

  update nodo_inmo.owner_settlements
     set status           = 'settled',
         settled_date     = v_today,
         breakdown        = v_breakdown,
         settlement_group = v_group
   where id = any(p_settlement_ids);

  update nodo_inmo.property_expenses
     set applied_settlement_id = v_anchor_id
   where id = any(
     select (elem->>'id')::uuid
     from jsonb_array_elements(v_deductions) elem
   );

  return v_breakdown;
end;
$$;

revoke all on function nodo_inmo.settle_owner(uuid, text, uuid[]) from public;
grant execute on function nodo_inmo.settle_owner(uuid, text, uuid[]) to authenticated;
