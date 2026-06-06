import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export function usePropertyPhotoUrl(path: string | null | undefined) {
  return useQuery<string | null>({
    queryKey: ["property-photo-url", path ?? ""],
    enabled: !!path,
    staleTime: 55 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("property-photos")
        .createSignedUrl(path, 3600);
      if (error) return null;
      return data.signedUrl;
    },
  });
}
