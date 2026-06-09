import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PROPERTIES_QUERY_KEY } from "./use-properties";

interface DeleteArgs {
  propertyId: string;
  path: string;
  currentPhotos: string[];
}

export function useDeletePropertyPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, path, currentPhotos }: DeleteArgs) => {
      await supabase.storage.from("property-photos").remove([path]);

      const newPhotos = currentPhotos.filter((p) => p !== path);

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
