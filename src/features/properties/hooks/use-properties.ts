import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type PropertyRow = Database["nodo_inmo"]["Tables"]["properties"]["Row"];

export const PROPERTIES_QUERY_KEY = ["nodo_inmo", "properties"] as const;

/**
 * Fetch all properties for the current user's org.
 * RLS on nodo_inmo.properties ensures only org-scoped rows are returned.
 */
export function useProperties() {
  return useQuery<PropertyRow[]>({
    queryKey: PROPERTIES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}
