import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";

export const CASH_ACCOUNTS_QUERY_KEY = ["cash-accounts"] as const;

export interface CashAccount {
  id: string;
  label: string;
  currency: "ARS" | "USD";
  kind: "BANCO" | "EFECTIVO";
  bank_name?: string | null;
  alias?: string | null;
  cbu?: string | null;
  sort_order?: number;
}

export const DEFAULT_CASH_ACCOUNTS: Omit<CashAccount, "id">[] = [
  { label: "Efectivo Pesos (ARS)", currency: "ARS", kind: "EFECTIVO", sort_order: 0 },
  { label: "Efectivo Dólares (USD)", currency: "USD", kind: "EFECTIVO", sort_order: 1 },
  { label: "Transferencia Pesos (ARS)", currency: "ARS", kind: "BANCO", sort_order: 2 },
];

const LEGACY_STORAGE_KEY = "nodo-cash-accounts";

function seededKey(orgId: string): string {
  return `nodo-cash-accounts-seeded-${orgId}`;
}

function markSeeded(orgId: string): void {
  localStorage.setItem(seededKey(orgId), "1");
}

function isSeeded(orgId: string): boolean {
  return localStorage.getItem(seededKey(orgId)) === "1";
}

function inferKind(label: string): "BANCO" | "EFECTIVO" {
  return label.toLowerCase().includes("efectivo") ? "EFECTIVO" : "BANCO";
}

function mapRow(row: Record<string, unknown>): CashAccount {
  return {
    id: row.id as string,
    label: row.label as string,
    currency: row.currency as "ARS" | "USD",
    kind: (row.kind as "BANCO" | "EFECTIVO") ?? inferKind(row.label as string),
    bank_name: (row.bank_name as string | null) ?? null,
    alias: (row.alias as string | null) ?? null,
    cbu: (row.cbu as string | null) ?? null,
    sort_order: (row.sort_order as number) ?? 0,
  };
}

async function seedDefaults(orgId: string): Promise<CashAccount[]> {
  const rows = DEFAULT_CASH_ACCOUNTS.map((a) => ({ ...a, org_id: orgId }));
  const { data, error } = await supabase
    .schema("nodo_inmo")
    .from("cash_accounts")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

async function migrateLegacyLocalStorage(orgId: string): Promise<CashAccount[] | null> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Array<{
      id: string;
      label: string;
      currency: "ARS" | "USD";
    }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const rows = parsed.map((a, i) => ({
      org_id: orgId,
      label: a.label,
      currency: a.currency,
      kind: inferKind(a.label),
      sort_order: i,
    }));

    const { data, error } = await supabase
      .schema("nodo_inmo")
      .from("cash_accounts")
      .insert(rows)
      .select();

    if (error) throw error;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    markSeeded(orgId);
    return (data ?? []).map(mapRow);
  } catch {
    return null;
  }
}

/** Fetch cash accounts for the org; seeds defaults on first use. */
export function useCashAccounts() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<CashAccount[]>({
    queryKey: [...CASH_ACCOUNTS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("cash_accounts")
        .select("*")
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) return data.map(mapRow);

      // Org already initialized — respect empty list after user deletions.
      if (isSeeded(orgId)) return [];

      const migrated = await migrateLegacyLocalStorage(orgId);
      if (migrated && migrated.length > 0) return migrated;

      const seeded = await seedDefaults(orgId);
      markSeeded(orgId);
      return seeded;
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const addAccount = useMutation({
    mutationFn: async (
      account: Omit<CashAccount, "id"> & {
        bank_name?: string;
        alias?: string;
        cbu?: string;
      },
    ) => {
      if (!orgId) throw new Error("No org_id");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("cash_accounts")
        .insert({
          org_id: orgId,
          label: account.label,
          currency: account.currency,
          kind: account.kind,
          bank_name: account.bank_name ?? null,
          alias: account.alias ?? null,
          cbu: account.cbu ?? null,
          sort_order: account.sort_order ?? 99,
        })
        .select()
        .single();

      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_ACCOUNTS_QUERY_KEY });
    },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("cash_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_ACCOUNTS_QUERY_KEY });
    },
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    addAccount: addAccount.mutateAsync,
    removeAccount: removeAccount.mutateAsync,
    isAdding: addAccount.isPending,
    isRemoving: removeAccount.isPending,
  };
}
