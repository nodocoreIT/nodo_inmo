import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { OWNER_SETTLEMENTS_QUERY_KEY } from "./use-owner-settlements";

export interface SettleOwnerInput {
  owner_id: string;
  owner_name: string;
  settlement_ids: string[];
  total: number;
  currency: string;
}

/**
 * Settle an owner: mark all of that owner's pending settlements as paid.
 *
 * Accounting model A ("Caja = agency money only"): the owner's share never
 * entered Caja (only the commission did), so paying it out does NOT create a
 * Caja expense — it would otherwise drive the balance negative. The payout is
 * recorded by the settlement's status + settled_date.
 */
export function useSettleOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SettleOwnerInput) => {
      if (input.settlement_ids.length === 0) return;

      const today = new Date().toISOString().slice(0, 10);

      const { error } = await supabase
        .schema("nodo_inmo")
        .from("owner_settlements")
        .update({ status: "settled", settled_date: today })
        .in("id", input.settlement_ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY });
    },
  });
}
