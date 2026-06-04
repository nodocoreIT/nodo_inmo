import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

const BUCKET = "property-expense-receipts";
/** Signed URL TTL in seconds (60 s — short-lived, minted at read time). */
const TTL_SECONDS = 60;

/**
 * Generate a signed URL for a receipt stored in the private bucket.
 *
 * NEVER uses getPublicUrl — the bucket is private and public URLs are blocked.
 * Signed URLs are scoped by the storage RLS policy (admin + org path check).
 */
export function useReceiptUrl(receiptPath: string | null | undefined) {
  return useQuery<string | null>({
    queryKey: ["storage", "receipt-url", receiptPath],
    queryFn: async () => {
      if (!receiptPath) return null;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(receiptPath, TTL_SECONDS);

      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!receiptPath,
    // Stale immediately — URL TTL is 60 s, so refetch on every mount.
    staleTime: 0,
  });
}
