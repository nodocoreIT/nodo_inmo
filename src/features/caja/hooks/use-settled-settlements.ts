import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import {
  groupSealedBySettlementGroup,
  type SealedGroup,
} from "@/features/caja/lib/caja-math";
import type { SettlementForGrouping } from "@/features/caja/lib/caja-math";

export type { SealedGroup };

export const SETTLED_SETTLEMENTS_QUERY_KEY = [
  "nodo_inmo",
  "owner_settlements",
  "settled",
] as const;

export interface UseSettledSettlementsResult {
  groups: SealedGroup[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Bounded query for settled settlements — newest first, limited to 50 rows.
 *
 * Uses a distinct query key from OWNER_SETTLEMENTS_QUERY_KEY so the cache entry
 * is independent and switching to the Historial tab never perturbs the
 * Liquidaciones/Movimientos cache (REQ-09, design D2).
 *
 * Grouping by settlement_group is done inside the queryFn so the returned
 * data is already shaped as SealedGroup[] — the component is purely presentational.
 */
export function useSettledSettlements(): UseSettledSettlementsResult {
  const { data, isLoading, isError } = useQuery<SealedGroup[]>({
    queryKey: SETTLED_SETTLEMENTS_QUERY_KEY,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .schema("nodo_inmo")
        .from("owner_settlements")
        .select("*, owner:contacts!owner_settlements_owner_id_fkey(name)")
        .eq("status", "settled")
        .order("settled_date", { ascending: false })
        .limit(50);

      if (error) throw error;

      return groupSealedBySettlementGroup(
        (rows ?? []) as unknown as SettlementForGrouping[],
      );
    },
  });

  return {
    groups: data ?? [],
    isLoading,
    isError,
  };
}
