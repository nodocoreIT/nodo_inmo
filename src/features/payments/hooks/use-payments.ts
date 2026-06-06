import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type PaymentRow = Database["nodo_inmo"]["Tables"]["payments"]["Row"];

/** Payment row enriched with the related contract's property address, tenant name, and owner name. */
export type PaymentWithRelations = PaymentRow & {
  contract: {
    property: { address: string; owner: { name: string } | null } | null;
    tenant: { name: string } | null;
  } | null;
};

export const PAYMENTS_QUERY_KEY = ["nodo_inmo", "payments"] as const;

/**
 * Fetch installments for the current org, ordered by due date, embedding the
 * contract's property address and tenant name for display. RLS scopes rows.
 */
export function usePayments() {
  return useQuery<PaymentWithRelations[]>({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("payments")
        .select(
          "*, contract:contracts!payments_contract_id_fkey(property:properties!contracts_property_id_fkey(address, owner:contacts!properties_owner_contact_id_fkey(name)), tenant:contacts!contracts_tenant_id_fkey(name))",
        )
        .order("due_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as PaymentWithRelations[];
    },
  });
}
