import { supabase } from "@/shared/lib/supabase";
import { generateInstallments } from "./generate-installments";

export interface SyncInstallmentsContract {
  id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
  status: string;
}

/**
 * Generate missing monthly installments for an active contract.
 * Idempotent: existing (contract_id, period) rows are left unchanged.
 */
export async function syncContractInstallments(
  orgId: string,
  contract: SyncInstallmentsContract,
): Promise<{ inserted: number }> {
  if (contract.status !== "active") return { inserted: 0 };
  if (!contract.start_date || !contract.end_date || !contract.rent_amount) {
    return { inserted: 0 };
  }

  const drafts = generateInstallments({
    start_date: contract.start_date,
    end_date: contract.end_date,
    rent_amount: contract.rent_amount,
    currency: contract.currency,
  });

  if (drafts.length === 0) return { inserted: 0 };

  const rows = drafts.map((d) => ({
    org_id: orgId,
    contract_id: contract.id,
    period: d.period,
    due_date: d.due_date,
    amount: d.amount,
    currency: d.currency,
    status: d.status,
  }));

  const { error } = await supabase
    .schema("nodo_inmo")
    .from("payments")
    .upsert(rows, { onConflict: "contract_id,period", ignoreDuplicates: true });

  if (error) throw error;
  return { inserted: rows.length };
}
