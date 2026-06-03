import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type ContractRow = Database["nodo_inmo"]["Tables"]["contracts"]["Row"];

/** Contract row enriched with the related property address and tenant name. */
export type ContractWithRelations = ContractRow & {
  property: { address: string } | null;
  tenant: { name: string } | null;
};

export const CONTRACTS_QUERY_KEY = ["nodo_inmo", "contracts"] as const;

/**
 * Fetch contracts for the current org, embedding the property address and
 * tenant name via PostgREST resource embedding. RLS scopes rows to the org.
 */
export function useContracts() {
  return useQuery<ContractWithRelations[]>({
    queryKey: CONTRACTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .select(
          "*, property:properties!contracts_property_id_fkey(address), tenant:contacts!contracts_tenant_id_fkey(name)",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ContractWithRelations[];
    },
  });
}
