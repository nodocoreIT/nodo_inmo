import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PROPERTIES_QUERY_KEY } from "./use-properties";

interface ReorderArgs {
  propertyId: string;
  newPhotos: string[];
}

export function useReorderPropertyPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, newPhotos }: ReorderArgs) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .update({
          photos: newPhotos,
          main_photo: newPhotos[0] ?? null,
        } as never)
        .eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["portal", "properties"] });
    },
  });
}
