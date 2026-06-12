import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";
import { syncContractInstallments } from "@/features/payments/lib/sync-contract-installments";
import { PAYMENTS_QUERY_KEY } from "@/features/payments/hooks/use-payments";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";

type ContractUpdate = Database["nodo_inmo"]["Tables"]["contracts"]["Update"];

export type UpdateContractInput = Omit<ContractUpdate, "org_id"> & {
  id: string;
  /** Full desired set of guarantor contact ids; links are reconciled to match. */
  guarantor_ids?: string[];
};

export function useUpdateContract() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async ({ id, guarantor_ids, ...fields }: UpdateContractInput) => {
      const { data: updated, error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .update(fields)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Reconcile guarantor links: clear the contract's links, then re-insert
      // the desired set. Simple and correct for the volumes involved.
      if (guarantor_ids) {
        const { error: delError } = await supabase
          .schema("nodo_inmo")
          .from("contract_guarantors")
          .delete()
          .eq("contract_id", id);

        if (delError) throw delError;

        if (guarantor_ids.length > 0 && orgId) {
          const links = guarantor_ids.map((guarantor_id) => ({
            org_id: orgId,
            contract_id: id,
            guarantor_id,
          }));

          const { error: insError } = await supabase
            .schema("nodo_inmo")
            .from("contract_guarantors")
            .insert(links);

          if (insError) throw insError;
        }
      }

      if (orgId && updated) {
        await syncContractInstallments(orgId, {
          id: updated.id,
          start_date: updated.start_date,
          end_date: updated.end_date,
          rent_amount: updated.rent_amount,
          currency: updated.currency,
          status: updated.status,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
