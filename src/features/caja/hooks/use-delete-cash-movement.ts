import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { CashMovementRow } from "./use-cash-movements";
import { CASH_MOVEMENTS_QUERY_KEY } from "./use-cash-movements";

/**
 * Delete a cash movement. Commission rows linked to a payment annul the cobro
 * via annul_payment so caja, rendición and cuota stay consistent.
 */
export function useDeleteCashMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movement: CashMovementRow) => {
      if (movement.payment_id) {
        const { error } = await supabase.rpc("annul_payment", {
          p_payment_id: movement.payment_id,
        });
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .schema("nodo_inmo")
        .from("cash_movements")
        .delete()
        .eq("id", movement.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });
}
