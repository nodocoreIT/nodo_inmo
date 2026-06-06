import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Json } from "@/shared/types/database";
import { OWNER_SETTLEMENTS_QUERY_KEY } from "./use-owner-settlements";
import { SETTLED_SETTLEMENTS_QUERY_KEY } from "./use-settled-settlements";

export interface SettleOwnerInput {
  owner_id: string;
  owner_name: string;
  settlement_ids: string[];
  total: number;
  currency: string;
}

/**
 * Settle an owner atomically via the settle_owner Postgres RPC.
 *
 * The RPC runs as a single transaction (HEADLINE-1 / ADR-2):
 *   1. Writes the breakdown JSONB snapshot onto every settlement row.
 *   2. Stamps applied_settlement_id on consumed chargeable expenses.
 *   3. Flips status → 'settled' with settled_date.
 *
 * All three writes commit together or roll back together — impossible to achieve
 * with three sequential .from() calls over the Data API.
 *
 * Returns the sealed breakdown JSONB (cast to Json by the generated types),
 * which caja-page can feed to the PDF builder in PR-C.
 */
export function useSettleOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SettleOwnerInput): Promise<Json | null> => {
      if (input.settlement_ids.length === 0) return null;

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .rpc("settle_owner", {
          p_owner_id: input.owner_id,
          p_currency: input.currency,
          p_settlement_ids: input.settlement_ids,
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SETTLED_SETTLEMENTS_QUERY_KEY });
    },
  });
}
