import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PAYMENTS_QUERY_KEY } from "./use-payments";
import { OWNER_SETTLEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-owner-settlements";
import { CASH_MOVEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-cash-movements";

/** Hard-delete an unpaid installment (no cobro posted yet). */
export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });
}

/**
 * Revert a collected installment via annul_payment RPC (cleans caja + rendición + cuota).
 */
export function useAnnulPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .rpc("annul_payment", { p_payment_id: paymentId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });
}

/** Tag the auto-posted commission movement with the selected cash account. */
export async function assignCommissionAccount(
  paymentId: string,
  accountLabel: string,
) {
  const { error } = await supabase
    .schema("nodo_inmo")
    .from("cash_movements")
    .update({ category: accountLabel })
    .eq("payment_id", paymentId)
    .eq("source", "commission");

  if (error) throw error;
}
