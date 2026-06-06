import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type ContractRow = Database["nodo_inmo"]["Tables"]["contracts"]["Row"];

/** Contact party with optional DNI and address (used for owner, tenant, and guarantors). */
export type ContactParty = {
  name: string;
  dni: string | null;
  address: string | null;
};

/** Contract row enriched with deeply embedded property (+ owner), tenant (+ dni), and guarantors (+ dni). */
export type ContractWithRelations = ContractRow & {
  property:
    | {
        address: string;
        property_type: string;
        rooms: number | null;
        total_sqm: number | null;
        inventory_description: string | null;
        owner: (ContactParty & { email: string | null; phone: string | null }) | null;
      }
    | null;
  tenant: ContactParty | null;
  guarantors: { guarantor_id: string; guarantor: ContactParty | null }[];
};

export const CONTRACTS_QUERY_KEY = ["nodo_inmo", "contracts"] as const;

/**
 * Fetch contracts for the current org, embedding the property (with owner),
 * tenant (with DNI + address), and guarantors (with DNI + address) via
 * PostgREST resource embedding. RLS scopes rows to the org.
 *
 * Phase C: deepened select to include owner via properties FK, tenant DNI,
 * and guarantor DNI — required by the ContractLocación PDF mapper.
 */
export function useContracts() {
  return useQuery<ContractWithRelations[]>({
    queryKey: CONTRACTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .select(
          "*, " +
          "property:properties!contracts_property_id_fkey(" +
            "address, property_type, rooms, total_sqm, inventory_description, " +
            "owner:contacts!properties_owner_contact_id_fkey(name, dni, email, phone, address)" +
          "), " +
          "tenant:contacts!contracts_tenant_id_fkey(name, dni, address), " +
          "guarantors:contract_guarantors(guarantor_id, guarantor:contacts!contract_guarantors_guarantor_id_fkey(name, dni, address))",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ContractWithRelations[];
    },
  });
}
