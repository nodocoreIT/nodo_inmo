import { supabase } from "@/shared/lib/supabase";
import {
  computeSettlementBreakdown,
  type OwnerGroup,
} from "@/features/caja/lib/caja-math";
import {
  buildStatementData,
  type SealedBreakdown,
  type StatementData,
} from "@/features/caja/lib/settlement-statement-data";
import type { OrgProfileRow } from "@/features/agency-profile/hooks/use-org-profile";
import type { SettlementWithOwner } from "@/features/caja/hooks/use-owner-settlements";

/**
 * Build a projected statement for pending settlements (pre-finalizar).
 * Uses computeSettlementBreakdown — display only, not the sealed snapshot.
 */
export async function buildPendingStatementData(
  group: OwnerGroup,
  settlements: SettlementWithOwner[],
  agency: OrgProfileRow | null,
  logoUrl: string | null,
): Promise<StatementData> {
  const batch = settlements.filter(
    (s) =>
      s.status === "pending" &&
      s.owner_id === group.owner_id &&
      s.currency === group.currency &&
      group.settlement_ids.includes(s.id),
  );

  const paymentIds = batch.map((s) => s.payment_id);

  const { data: payments, error: paymentsError } = await supabase
    .schema("nodo_inmo")
    .from("payments")
    .select("id, amount, currency, contract_id")
    .in("id", paymentIds);

  if (paymentsError) throw paymentsError;

  const { data: movements, error: movementsError } = await supabase
    .schema("nodo_inmo")
    .from("cash_movements")
    .select("payment_id, amount")
    .eq("source", "commission")
    .in("payment_id", paymentIds);

  if (movementsError) throw movementsError;

  const { data: expenses, error: expensesError } = await supabase
    .schema("nodo_inmo")
    .from("property_expenses")
    .select(
      "id, amount, currency, expense_date, description, type, property:properties!property_expenses_property_id_fkey(owner_id)",
    )
    .eq("charged_to_owner", true)
    .is("applied_settlement_id", null);

  if (expensesError) throw expensesError;

  const ownerExpenses = (expenses ?? []).filter((e) => {
    const raw = e.property as unknown;
    const property = Array.isArray(raw)
      ? (raw[0] as { owner_id: string | null } | undefined)
      : (raw as { owner_id: string | null } | null);
    return property?.owner_id === group.owner_id;
  });

  const { data: ownerContact } = await supabase
    .schema("nodo_inmo")
    .from("contacts")
    .select("commission_rate")
    .eq("id", group.owner_id)
    .maybeSingle();

  const breakdown = computeSettlementBreakdown(
    (payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
    })),
    (movements ?? [])
      .filter((m) => m.payment_id)
      .map((m) => ({ payment_id: m.payment_id!, amount: m.amount })),
    ownerExpenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      currency: e.currency ?? group.currency,
      expense_date: e.expense_date ?? "",
      description: e.description ?? "",
      type: e.type ?? "",
    })),
    ownerContact?.commission_rate ?? 0,
    group.currency,
  );

  const sealedLike: SealedBreakdown = {
    ...breakdown,
    currency: group.currency,
    cobro_count: batch.length,
  };

  return buildStatementData({
    breakdown: sealedLike,
    agency,
    logoUrl,
    ownerName: group.owner_name,
    settledDate: new Date().toISOString().slice(0, 10),
  });
}
