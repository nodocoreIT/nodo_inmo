import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";
import { OWNERS_QUERY_KEY } from "./use-owners";

type OwnerInsert = Database["nodo_inmo"]["Tables"]["owners"]["Insert"];

export type CreateOwnerInput = Omit<OwnerInsert, "org_id">;

export function useCreateOwner() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateOwnerInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("owners")
        .insert({ ...input, org_id: orgId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OWNERS_QUERY_KEY });
    },
  });
}
