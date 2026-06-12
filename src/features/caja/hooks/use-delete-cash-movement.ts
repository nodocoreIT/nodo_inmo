import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { CASH_MOVEMENTS_QUERY_KEY } from "./use-cash-movements";

/** Delete a manual cash movement. */
export function useDeleteCashMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("cash_movements")
        .delete()
        .eq("id", id)
        .eq("source", "manual");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });
}
