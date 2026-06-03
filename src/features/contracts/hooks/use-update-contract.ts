import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";
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
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .update(fields)
        .eq("id", id);

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
    },
  });
}
