import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";
import { syncContractInstallments } from "@/features/payments/lib/sync-contract-installments";
import { PAYMENTS_QUERY_KEY } from "@/features/payments/hooks/use-payments";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";

type ContractInsert = Database["nodo_inmo"]["Tables"]["contracts"]["Insert"];

export type CreateContractInput = Omit<ContractInsert, "org_id"> & {
  /** Contact ids playing the guarantor role on this contract. */
  guarantor_ids?: string[];
};

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async ({ guarantor_ids = [], ...fields }: CreateContractInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data: contract, error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .insert({ ...fields, org_id: orgId })
        .select()
        .single();

      if (error) throw error;

      if (guarantor_ids.length > 0) {
        const links = guarantor_ids.map((guarantor_id) => ({
          org_id: orgId,
          contract_id: contract.id,
          guarantor_id,
        }));

        const { error: linkError } = await supabase
          .schema("nodo_inmo")
          .from("contract_guarantors")
          .insert(links);

        if (linkError) throw linkError;
      }

      await syncContractInstallments(orgId, {
        id: contract.id,
        start_date: contract.start_date,
        end_date: contract.end_date,
        rent_amount: contract.rent_amount,
        currency: contract.currency,
        status: contract.status,
      });

      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
