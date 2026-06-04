import { Search } from "lucide-react";
import { useSearchStore } from "@/shared/search/use-search-store";
import { cn } from "@/shared/lib/utils";

interface SearchInputProps {
  placeholder?: string;
  className?: string;
}

/**
 * Global search box for the admin top bar. Reads/writes the shared search
 * store; the active list filters its own data from the same store.
 */
export function SearchInput({ placeholder = "Buscar…", className }: SearchInputProps) {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);

  return (
    <div className={cn("relative w-72 max-w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate2" />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 w-full rounded-pill border border-border bg-paper pl-9 pr-4 text-sm text-foreground placeholder:text-slate2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}
