import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type CashMovementRow = Database["nodo_inmo"]["Tables"]["cash_movements"]["Row"];

export const CASH_MOVEMENTS_QUERY_KEY = ["nodo_inmo", "cash_movements"] as const;

/** List the org's cash movements (admin-only via RLS), newest first. */
export function useCashMovements() {
  return useQuery<CashMovementRow[]>({
    queryKey: CASH_MOVEMENTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("cash_movements")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}
