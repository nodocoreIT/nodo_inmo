import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import { PAYMENTS_QUERY_KEY } from "./use-payments";
import { CASH_MOVEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-cash-movements";
import { OWNER_SETTLEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-owner-settlements";

type PaymentUpdate = Database["nodo_inmo"]["Tables"]["payments"]["Update"];

export type UpdatePaymentInput = Omit<PaymentUpdate, "org_id"> & { id: string };

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdatePaymentInput) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("payments")
        .update(fields)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY });
    },
  });
}
