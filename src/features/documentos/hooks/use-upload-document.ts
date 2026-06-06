import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import { DOCUMENTS_QUERY_KEY } from "./use-documents";

const BUCKET = "org-documents";

export type DocumentType = "factura" | "presupuesto" | "certificado" | "otro";

export interface UploadDocumentInput {
  file: File;
  label: string;
  document_type: DocumentType;
  property_id?: string;
  contract_id?: string;
  notes?: string;
}

/**
 * Sanitize a filename: lowercase, replace spaces/special chars with hyphens,
 * collapse consecutive hyphens.
 *
 * Keeps alphanumeric chars, dots, hyphens, and underscores.
 */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Composite mutation: upload file to org-documents bucket, then insert DB row.
 *
 * Storage path: {org_id}/{uuid}-{sanitized_filename}
 * The org_id is the FIRST path segment — required by the storage RLS policy
 * which checks (storage.foldername(name))[1] = JWT app_metadata.org_id.
 *
 * ADR-D4: single hook for atomicity at the UX level. If DB insert fails after
 * upload, the orphaned file is accepted (same tradeoff as useUploadReceipt).
 */
export function useUploadDocument() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadDocumentInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      // 1. Upload file to storage
      const key = `${orgId}/${crypto.randomUUID()}-${sanitizeFilename(input.file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(key, input.file, { upsert: false });

      if (uploadError) throw uploadError;

      // 2. Insert DB row
      const { data, error: insertError } = await supabase
        .schema("nodo_inmo")
        .from("documents")
        .insert({
          org_id: orgId,
          file_path: key,
          label: input.label,
          document_type: input.document_type,
          property_id: input.property_id ?? null,
          contract_id: input.contract_id ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });
}
