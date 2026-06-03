import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";

/**
 * Delete a contract. contract_guarantors links cascade away via the FK
 * (ON DELETE CASCADE), so no manual cleanup is needed.
 */
export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
    },
  });
}
