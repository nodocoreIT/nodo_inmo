import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PROPERTIES_QUERY_KEY } from "@/features/properties/hooks/use-properties";

interface UploadPropertyPhotoArgs {
  propertyId: string;
  orgId: string;
  file: File;
}

export function useUploadPropertyPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, orgId, file }: UploadPropertyPhotoArgs) => {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${orgId}/${propertyId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .update({ main_photo: path })
        .eq("id", propertyId);

      if (updateError) throw updateError;
      return path;
    },
    onSuccess: (_path) => {
      void queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["property-photo-url", _path] });
      void queryClient.invalidateQueries({ queryKey: ["portal", "properties"] });
    },
  });
}
