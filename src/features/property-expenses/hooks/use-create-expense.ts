import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";

type PropertyExpenseInsert =
  Database["nodo_inmo"]["Tables"]["property_expenses"]["Insert"];

export type CreateExpenseInput = Omit<PropertyExpenseInsert, "org_id">;

export const PROPERTY_EXPENSES_QUERY_KEY = [
  "nodo_inmo",
  "property_expenses",
] as const;

/** Insert a property expense row (admin-only via RLS). */
export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("property_expenses")
        .insert({ ...input, org_id: orgId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTY_EXPENSES_QUERY_KEY });
    },
  });
}
