import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type PropertyRow = Database["nodo_inmo"]["Tables"]["properties"]["Row"];

export type PortalProperty = PropertyRow & {
  owner: { name: string; phone: string | null } | null;
};

export const PORTAL_PROPERTIES_QUERY_KEY = ["portal", "properties"] as const;

export function usePortalProperties() {
  return useQuery<PortalProperty[]>({
    queryKey: PORTAL_PROPERTIES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .select("*, owner:contacts!properties_owner_contact_id_fkey(name, phone)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as PortalProperty[];
    },
  });
}
