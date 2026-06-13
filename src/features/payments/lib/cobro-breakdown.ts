import type { PaymentWithRelations } from "../hooks/use-payments";

export interface CobroBreakdown {
  rentAmount: number;
  expensesAmount: number;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  ownerShare: number;
}

export function resolveCommissionRatePercent(payment: PaymentWithRelations): number {
  const contract = payment.contract;
  if (contract?.commission_amount != null && contract.rent_amount > 0) {
    return Math.round((contract.commission_amount / contract.rent_amount) * 10000) / 100;
  }
  if (contract?.property?.commission_rate != null) {
    return contract.property.commission_rate;
  }
  if (contract?.property?.owner?.commission_rate != null) {
    return contract.property.owner.commission_rate;
  }
  return 10;
}

export function buildCobroBreakdown(
  payment: PaymentWithRelations,
  commissionAmountFromCaja?: number | null,
): CobroBreakdown {
  const rentAmount = payment.paid_amount ?? payment.amount;
  const expensesAmount = payment.expenses_amount ?? 0;
  const grossAmount = rentAmount + expensesAmount;
  const commissionRate = resolveCommissionRatePercent(payment);

  const commissionAmount =
    commissionAmountFromCaja != null
      ? commissionAmountFromCaja
      : Math.round(grossAmount * commissionRate) / 100;

  const effectiveRate =
    grossAmount > 0
      ? Math.round((commissionAmount / grossAmount) * 10000) / 100
      : commissionRate;

  return {
    rentAmount,
    expensesAmount,
    grossAmount,
    commissionRate: effectiveRate,
    commissionAmount,
    ownerShare: grossAmount - commissionAmount,
  };
}
