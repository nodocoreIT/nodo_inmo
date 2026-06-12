import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";

export const CONCEPTOS_QUERY_KEY = ["conceptos"] as const;

export interface ConceptoRow {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

/** Fetch conceptos for the current org, ordered by name. */
export function useConceptos() {
  const { orgId } = useAuth();

  return useQuery<ConceptoRow[]>({
    queryKey: [...CONCEPTOS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("conceptos")
        .select("*")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

/** Create a new concepto for the org (idempotent on duplicate name). */
export function useCreateConcepto() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const trimmed = name.trim();
      if (!trimmed) throw new Error("El concepto no puede estar vacío");

      const { data: existing, error: findError } = await supabase
        .schema("nodo_inmo")
        .from("conceptos")
        .select("*")
        .eq("org_id", orgId)
        .eq("name", trimmed)
        .maybeSingle();

      if (findError) throw findError;
      if (existing) return existing as ConceptoRow;

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("conceptos")
        .insert({ org_id: orgId, name: trimmed })
        .select()
        .single();

      if (error) throw error;
      return data as ConceptoRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONCEPTOS_QUERY_KEY });
    },
  });
}
