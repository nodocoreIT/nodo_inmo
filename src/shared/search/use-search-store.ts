import { create } from "zustand";

/**
 * Global search query shared between the admin top-bar SearchInput and the
 * active list. A single global store (not a provider) keeps the layout and the
 * feature lists decoupled: each list reads `query` and filters its own data.
 * The layout resets the query on route change so areas don't inherit each
 * other's search.
 */
interface SearchState {
  query: string;
  setQuery: (query: string) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
  reset: () => set({ query: "" }),
}));
