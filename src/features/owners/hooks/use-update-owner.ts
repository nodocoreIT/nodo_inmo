import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import { OWNERS_QUERY_KEY } from "./use-owners";

type OwnerUpdate = Database["nodo_inmo"]["Tables"]["contacts"]["Update"];

export type UpdateOwnerInput = Omit<OwnerUpdate, "org_id"> & {
  id: string;
};

export function useUpdateOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateOwnerInput) => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contacts")
        .update(fields)
        .eq("id", id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OWNERS_QUERY_KEY });
    },
  });
}
