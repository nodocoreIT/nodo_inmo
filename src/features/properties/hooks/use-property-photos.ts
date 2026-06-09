import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export type ResolvedPhoto = { path: string; url: string };

export function usePropertyPhotos(paths: string[]) {
  return useQuery<ResolvedPhoto[]>({
    queryKey: ["property-photos", paths.join(",")],
    enabled: paths.length > 0,
    staleTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("property-photos")
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      return (data ?? [])
        .filter((d): d is { path: string; signedUrl: string; error: string | null } =>
          typeof d.path === "string" && typeof d.signedUrl === "string"
        )
        .map((d) => ({ path: d.path, url: d.signedUrl }));
    },
  });
}
