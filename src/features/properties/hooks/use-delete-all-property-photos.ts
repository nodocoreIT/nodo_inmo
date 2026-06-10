import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PROPERTIES_QUERY_KEY } from "./use-properties";

interface DeleteAllArgs {
  propertyId: string;
  paths: string[];
}

export function useDeleteAllPropertyPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, paths }: DeleteAllArgs) => {
      if (paths.length > 0) {
        await supabase.storage.from("property-photos").remove(paths);
      }
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .update({ photos: [], main_photo: null } as never)
        .eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["portal", "properties"] });
    },
  });
}
