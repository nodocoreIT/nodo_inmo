import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";

type OrgProfileUpdate =
  Database["nodo_inmo"]["Tables"]["org_profiles"]["Update"];

/** Omit org_id — it is injected from the authenticated session. */
export type UpsertOrgProfileInput = Omit<OrgProfileUpdate, "org_id">;

export const ORG_PROFILE_QUERY_KEY = ["nodo_inmo", "org_profiles"] as const;

/**
 * Upsert the org's agency profile row (admin-only via RLS).
 * Conflicts on org_id (the PK) are resolved by UPDATE — second save
 * updates the existing row rather than rejecting with a unique violation.
 */
export function useUpsertOrgProfile() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: UpsertOrgProfileInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("org_profiles")
        .upsert({ ...input, org_id: orgId }, { onConflict: "org_id" });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_PROFILE_QUERY_KEY });
    },
  });
}
