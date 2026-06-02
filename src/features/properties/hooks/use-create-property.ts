import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";
import { PROPERTIES_QUERY_KEY } from "./use-properties";

type PropertyInsert = Database["nodo_inmo"]["Tables"]["properties"]["Insert"];

export type CreatePropertyInput = Omit<PropertyInsert, "org_id">;

export function useCreateProperty() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: CreatePropertyInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .insert({ ...input, org_id: orgId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
    },
  });
}
