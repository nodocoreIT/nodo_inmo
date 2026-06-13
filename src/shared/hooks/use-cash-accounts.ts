import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import { CASH_MOVEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-cash-movements";

export const CASH_ACCOUNTS_QUERY_KEY = ["cash-accounts"] as const;

export interface CashAccount {
  id: string;
  label: string;
  currency: "ARS" | "USD";
  kind: "BANCO" | "EFECTIVO";
  bank_name?: string | null;
  alias?: string | null;
  cbu?: string | null;
  initial_balance?: number;
  sort_order?: number;
}

export interface BankAccountInput {
  bank_name: string;
  alias?: string;
  cbu: string;
  currency: "ARS" | "USD";
  initial_balance?: number;
}

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

export function buildAccountLabel(bankName: string, currency: "ARS" | "USD"): string {
  return `${bankName} (${currency === "ARS" ? "Pesos" : "Dólares"})`;
}

function mapRow(row: Record<string, unknown>): CashAccount {
  return {
    id: row.id as string,
    label: row.label as string,
    currency: row.currency as "ARS" | "USD",
    kind: (row.kind as "BANCO" | "EFECTIVO") ?? "BANCO",
    bank_name: (row.bank_name as string | null) ?? null,
    alias: (row.alias as string | null) ?? null,
    cbu: (row.cbu as string | null) ?? null,
    initial_balance: Number(row.initial_balance ?? 0),
    sort_order: (row.sort_order as number) ?? 0,
  };
}

async function migrateLegacyLocalStorage(orgId: string): Promise<CashAccount[] | null> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Array<{
      label: string;
      currency: "ARS" | "USD";
    }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const rows = parsed.map((a, i) => ({
      org_id: orgId,
      label: a.label,
      currency: a.currency,
      kind: "BANCO",
      bank_name: a.label,
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

async function createOpeningMovement(
  orgId: string,
  account: CashAccount,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.schema("nodo_inmo").from("cash_movements").insert({
    org_id: orgId,
    type: "income",
    amount,
    currency: account.currency,
    date: today,
    concept: "Saldo inicial",
    category: account.label,
    cash_account_id: account.id,
    source: "manual",
  });

  if (error) throw error;
}

/** Fetch bank/cash accounts for the org. */
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

      if (isSeeded(orgId)) return [];

      const migrated = await migrateLegacyLocalStorage(orgId);
      if (migrated && migrated.length > 0) return migrated;

      markSeeded(orgId);
      return [];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const addAccount = useMutation({
    mutationFn: async (input: BankAccountInput) => {
      if (!orgId) throw new Error("No org_id");

      const label = buildAccountLabel(input.bank_name.trim(), input.currency);
      const initialBalance = input.initial_balance ?? 0;

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("cash_accounts")
        .insert({
          org_id: orgId,
          label,
          currency: input.currency,
          kind: "BANCO",
          bank_name: input.bank_name.trim(),
          alias: input.alias?.trim() || null,
          cbu: input.cbu.trim(),
          initial_balance: initialBalance,
          sort_order: 99,
        })
        .select()
        .single();

      if (error) throw error;
      const account = mapRow(data);
      await createOpeningMovement(orgId, account, initialBalance);
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: BankAccountInput & { id: string }) => {
      if (!orgId) throw new Error("No org_id");

      const label = buildAccountLabel(input.bank_name.trim(), input.currency);

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("cash_accounts")
        .update({
          label,
          currency: input.currency,
          bank_name: input.bank_name.trim(),
          alias: input.alias?.trim() || null,
          cbu: input.cbu.trim(),
        })
        .eq("id", id)
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
    updateAccount: updateAccount.mutateAsync,
    removeAccount: removeAccount.mutateAsync,
    isAdding: addAccount.isPending,
    isUpdating: updateAccount.isPending,
    isRemoving: removeAccount.isPending,
  };
}
