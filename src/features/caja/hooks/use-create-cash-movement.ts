import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";
import { CASH_MOVEMENTS_QUERY_KEY } from "./use-cash-movements";

type CashMovementInsert = Database["nodo_inmo"]["Tables"]["cash_movements"]["Insert"];

export type CreateCashMovementInput = Omit<CashMovementInsert, "org_id">;

/** Create a manual cash movement (income/expense). */
export function useCreateCashMovement() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCashMovementInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("cash_movements")
        .insert({ ...input, org_id: orgId, source: "manual" });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });
}
