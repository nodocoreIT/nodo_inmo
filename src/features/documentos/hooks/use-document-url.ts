import { supabase } from "@/shared/lib/supabase";

const BUCKET = "org-documents";
/** Signed URL TTL in seconds (60 s — short-lived, minted at read time). */
const TTL_SECONDS = 60;

/**
 * Generate a signed URL for a document stored in the private org-documents bucket.
 *
 * ADR-D7: NEVER uses getPublicUrl — the bucket is private.
 * Signed URLs respect the storage RLS policy (admin + org path check).
 * Returns the URL string or throws on error.
 */
export async function getDocumentSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, TTL_SECONDS);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("No signed URL returned");
  return data.signedUrl;
}
