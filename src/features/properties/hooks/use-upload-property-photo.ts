import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PROPERTIES_QUERY_KEY } from "./use-properties";

interface UploadArgs {
  propertyId: string;
  orgId: string;
  file: File;
  currentPhotos: string[];
}

export function useUploadPropertyPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, orgId, file, currentPhotos }: UploadArgs) => {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${orgId}/${propertyId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const newPhotos = [...currentPhotos, path];

      const { error: updateError } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .update({
          photos: newPhotos,
          main_photo: newPhotos[0],
        } as never)
        .eq("id", propertyId);
      if (updateError) throw updateError;

      return path;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["portal", "properties"] });
    },
  });
}
