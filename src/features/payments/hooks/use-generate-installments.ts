import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { syncContractInstallments } from "@/features/payments/lib/sync-contract-installments";
import { PAYMENTS_QUERY_KEY } from "./use-payments";

export interface GenerateInstallmentsInput {
  contract_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
  status?: string;
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

      return syncContractInstallments(orgId, {
        id: contract.contract_id,
        start_date: contract.start_date,
        end_date: contract.end_date,
        rent_amount: contract.rent_amount,
        currency: contract.currency,
        status: contract.status ?? "active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
