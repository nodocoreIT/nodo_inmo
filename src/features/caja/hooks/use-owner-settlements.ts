import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type OwnerSettlementRow =
  Database["nodo_inmo"]["Tables"]["owner_settlements"]["Row"];

export type SettlementWithOwner = OwnerSettlementRow & {
  owner: { name: string } | null;
};

export const OWNER_SETTLEMENTS_QUERY_KEY = ["nodo_inmo", "owner_settlements"] as const;

/** List the org's owner settlements (admin-only via RLS), embedding the owner name. */
export function useOwnerSettlements() {
  return useQuery<SettlementWithOwner[]>({
    queryKey: OWNER_SETTLEMENTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("owner_settlements")
        .select(
          "*, owner:contacts!owner_settlements_owner_id_fkey(name)",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as SettlementWithOwner[];
    },
  });
}
