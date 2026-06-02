import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import { PROPERTIES_QUERY_KEY } from "./use-properties";

type PropertyUpdate = Database["nodo_inmo"]["Tables"]["properties"]["Update"];

export type UpdatePropertyInput = Omit<PropertyUpdate, "org_id"> & {
  id: string;
};

export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdatePropertyInput) => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .update(fields)
        .eq("id", id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
    },
  });
}
