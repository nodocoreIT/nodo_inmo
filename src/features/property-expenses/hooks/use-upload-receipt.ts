import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";

const BUCKET = "property-expense-receipts";

/** Sanitize a filename: replace spaces/special chars with hyphens. */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

export interface UploadReceiptInput {
  propertyId: string;
  file: File;
}

/**
 * Upload a receipt photo to the private bucket and return the storage key.
 *
 * Key format: {org_id}/{property_id}/{uuid}-{sanitized_filename}
 * The org_id is the FIRST path segment — required by the storage RLS policy
 * which checks (storage.foldername(name))[1] = JWT app_metadata.org_id.
 *
 * Returns the object key (never a URL). Signed URLs are generated at read time
 * via useReceiptUrl.
 */
export function useUploadReceipt() {
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async ({ propertyId, file }: UploadReceiptInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const key = `${orgId}/${propertyId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(key, file, { upsert: true });

      if (error) throw error;

      // Return the object key (path), not a URL.
      return data?.path ?? key;
    },
  });
}
