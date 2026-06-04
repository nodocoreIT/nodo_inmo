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
  return parts.some((p) =>
    p === null || p === undefined ? false : String(p).toLowerCase().includes(q),
  );
}
