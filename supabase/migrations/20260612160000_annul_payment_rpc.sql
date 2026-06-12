-- Revert a collected installment (annul cobro) atomically.
-- SECURITY DEFINER: agents can cobrar but only admins can DELETE caja rows via RLS.
-- This RPC mirrors the reversal of post_payment_to_caja in one transaction.

create or replace function nodo_inmo.annul_payment(p_payment_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_org_id            uuid;
  v_settlement_status text;
  v_jwt_org           uuid;
begin
  v_jwt_org := ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid;

  select org_id
    into v_org_id
  from nodo_inmo.payments
  where id = p_payment_id;

  if v_org_id is null then
    raise exception 'Cuota no encontrada';
  end if;

  if v_org_id is distinct from v_jwt_org then
    raise exception 'Sin permiso para anular esta cuota';
  end if;

  select status
    into v_settlement_status
  from nodo_inmo.owner_settlements
  where payment_id = p_payment_id;

  if v_settlement_status = 'settled' then
    raise exception 'No se puede anular: la rendición al propietario ya fue finalizada';
  end if;

  delete from nodo_inmo.owner_settlements
  where payment_id = p_payment_id;

  delete from nodo_inmo.cash_movements
  where payment_id = p_payment_id;

  update nodo_inmo.payments
  set
    status         = 'pending',
    paid_date      = null,
    paid_amount    = null,
    payment_method = null,
    updated_at     = now()
  where id = p_payment_id;
end;
$$;

revoke all on function nodo_inmo.annul_payment(uuid) from public;
grant execute on function nodo_inmo.annul_payment(uuid) to authenticated;
