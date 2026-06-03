import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { OWNERS_QUERY_KEY } from "./use-owners";

export function useDeleteOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("owners")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OWNERS_QUERY_KEY });
    },
  });
}
