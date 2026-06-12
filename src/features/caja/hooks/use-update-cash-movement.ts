import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import { CASH_MOVEMENTS_QUERY_KEY } from "./use-cash-movements";

type CashMovementUpdate = Database["nodo_inmo"]["Tables"]["cash_movements"]["Update"];

export type UpdateCashMovementInput = CashMovementUpdate & { id: string };

/** Update any cash movement (manual, commission, owner payout). */
export function useUpdateCashMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCashMovementInput) => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("cash_movements")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });
}
