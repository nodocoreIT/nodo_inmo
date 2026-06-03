import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import { CONTACTS_QUERY_KEY } from "./use-contacts";

type ContactUpdate = Database["nodo_inmo"]["Tables"]["contacts"]["Update"];

export type UpdateContactInput = Omit<ContactUpdate, "org_id"> & {
  id: string;
};

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateContactInput) => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contacts")
        .update(fields)
        .eq("id", id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}
