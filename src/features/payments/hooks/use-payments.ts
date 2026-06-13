import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type PaymentRow = Database["nodo_inmo"]["Tables"]["payments"]["Row"];

/** Payment row enriched with contract, property, tenant and owner for display/docs. */
export type PaymentWithRelations = PaymentRow & {
  expenses_amount?: number;
  contract: {
    rent_amount: number;
    commission_amount: number | null;
    property: {
      address: string;
      commission_rate: number | null;
      owner: { name: string; commission_rate?: number | null } | null;
    } | null;
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
          "*, contract:contracts!payments_contract_id_fkey(rent_amount, commission_amount, property:properties!contracts_property_id_fkey(address, commission_rate, owner:contacts!properties_owner_contact_id_fkey(name, commission_rate)), tenant:contacts!contracts_tenant_id_fkey(name))",
        )
        .order("due_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as PaymentWithRelations[];
    },
  });
}
