import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { DOCUMENTS_QUERY_KEY } from "./use-documents";

export interface DeleteDocumentInput {
  id: string;
  file_path: string;
}

/**
 * Delete a document: remove the storage object, then delete the DB row.
 *
 * Step order: storage first, then DB. If storage removal fails, DB delete is
 * NOT attempted. If DB delete fails after storage removal, the row is orphaned
 * (acceptable tradeoff — rare edge case, cleanable via console or future job).
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file_path }: DeleteDocumentInput) => {
      // 1. Remove storage object
      const { error: storageError } = await supabase.storage
        .from("org-documents")
        .remove([file_path]);

      if (storageError) throw storageError;

      // 2. Delete DB row
      const { error: dbError } = await supabase
        .schema("nodo_inmo")
        .from("documents")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });
}
