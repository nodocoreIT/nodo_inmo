/**
 * Case-insensitive substring match across several text fields.
 * An empty/whitespace query matches everything (no filtering).
 */
export function matchesQuery(
  parts: Array<string | number | null | undefined>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  
  // 1. Normal substring match (case insensitive)
  const matchesNormal = parts.some((p) =>
    p === null || p === undefined ? false : String(p).toLowerCase().includes(q),
  );
  if (matchesNormal) return true;

  // 2. Digit-only comparison (removes hyphens, spaces, etc.) for phone numbers and DNI
  const qClean = q.replace(/\D/g, "");
  if (qClean) {
    return parts.some((p) => {
      if (p === null || p === undefined) return false;
      const pClean = String(p).replace(/\D/g, "");
      return pClean.includes(qClean);
    });
  }

  return false;
}
