import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";
import { CONTACTS_QUERY_KEY } from "./use-contacts";

type ContactInsert = Database["nodo_inmo"]["Tables"]["contacts"]["Insert"];

export type CreateContactInput = Omit<ContactInsert, "org_id">;

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contacts")
        .insert({ ...input, org_id: orgId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}
