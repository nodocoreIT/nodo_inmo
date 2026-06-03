import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import { generateInstallments } from "@/features/payments/lib/generate-installments";
import { PAYMENTS_QUERY_KEY } from "./use-payments";

export interface GenerateInstallmentsInput {
  contract_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
}

/**
 * Generate the monthly installments for a contract and upsert them.
 * Idempotent: existing (contract_id, period) rows are skipped, so re-running
 * only fills in missing months.
 */
export function useGenerateInstallments() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (contract: GenerateInstallmentsInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const drafts = generateInstallments(contract);
      if (drafts.length === 0) return { inserted: 0 };

      const rows = drafts.map((d) => ({
        org_id: orgId,
        contract_id: contract.contract_id,
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
