-- Auto-post a cobro to Caja when an installment is marked paid.
--
-- When a payment transitions to status = 'paid', split the amount:
--   - agency commission (owner.commission_rate %) → cash_movements (income)
--   - the rest → owner_settlements (pending) for the property's owner
-- If the property has no owner, the whole amount is agency income (no settlement).
--
-- SECURITY DEFINER: runs as the function owner so it can write to the admin-only
-- Caja tables even when an AGENT marks the cobro (agents operate cobros but never
-- see Caja). Tenant isolation is preserved by copying the payment's org_id.
--
-- Idempotent: guarded by a transition check (old != paid → new = paid), a
-- "commission already posted" check, and the unique(payment_id) on settlements.
-- Reversals (paid → pending) are NOT unwound here — a future enhancement.

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

    select p.owner_id, coalesce(ct.commission_rate, 0)
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

create trigger post_payment_to_caja_aiu
  after update on nodo_inmo.payments
  for each row
  execute function nodo_inmo.post_payment_to_caja();
