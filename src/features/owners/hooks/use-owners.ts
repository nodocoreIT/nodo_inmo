import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type OwnerRow = Database["nodo_inmo"]["Tables"]["contacts"]["Row"];

export const OWNERS_QUERY_KEY = ["nodo_inmo", "contacts"] as const;

/**
 * Fetch all owners for the current user's org.
 * RLS on nodo_inmo.owners ensures only org-scoped rows are returned.
 */
export function useOwners() {
  return useQuery<OwnerRow[]>({
    queryKey: OWNERS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contacts")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}
