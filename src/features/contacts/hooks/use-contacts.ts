import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type ContactRow = Database["nodo_inmo"]["Tables"]["contacts"]["Row"];

export type ContactRole = "owner" | "tenant" | "guarantor";

export const CONTACTS_QUERY_KEY = ["nodo_inmo", "contacts"] as const;

/**
 * Fetch contacts for the current org.
 * When `role` is provided, filters via Postgres array containment:
 *   roles @> ARRAY[role]
 */
export function useContacts(role?: ContactRole) {
  return useQuery<ContactRow[]>({
    queryKey: role ? [...CONTACTS_QUERY_KEY, role] : CONTACTS_QUERY_KEY,
    queryFn: async () => {
      const base = supabase
        .schema("nodo_inmo")
        .from("contacts")
        .select("*");

      const query = role
        ? base.contains("roles", [role])
        : base;

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}
