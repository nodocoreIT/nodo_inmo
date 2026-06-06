import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type DocumentRow = Database["nodo_inmo"]["Tables"]["documents"]["Row"];

export type DocumentWithRelations = DocumentRow & {
  property: { address: string } | null;
  contract: {
    id: string;
    tenant: { name: string } | null;
  } | null;
};

export const DOCUMENTS_QUERY_KEY = ["nodo_inmo", "documents"] as const;

export interface DocumentsFilter {
  property_id?: string;
  contract_id?: string;
}

/**
 * Fetch documents for the current org, with optional property/contract filter.
 * Embeds property address and contract tenant name for display.
 * RLS scopes rows to the org (admin-only via Template B).
 */
export function useDocuments(filter?: DocumentsFilter) {
  return useQuery<DocumentWithRelations[]>({
    queryKey: filter ? [...DOCUMENTS_QUERY_KEY, filter] : DOCUMENTS_QUERY_KEY,
    queryFn: async () => {
      let query = supabase
        .schema("nodo_inmo")
        .from("documents")
        .select(
          "*, " +
          "property:properties!documents_property_id_fkey(address), " +
          "contract:contracts!documents_contract_id_fkey(id, tenant:contacts!contracts_tenant_id_fkey(name))",
        );

      if (filter?.property_id) query = query.eq("property_id", filter.property_id);
      if (filter?.contract_id) query = query.eq("contract_id", filter.contract_id);

      const { data, error } = await query.order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DocumentWithRelations[];
    },
  });
}
