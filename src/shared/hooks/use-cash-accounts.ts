import { create } from "zustand";

export interface CashAccount {
  id: string;
  label: string;
  currency: "ARS" | "USD";
}

export const DEFAULT_CASH_ACCOUNTS: CashAccount[] = [
  { id: "cash-ars", label: "Efectivo Pesos (ARS)", currency: "ARS" },
  { id: "cash-usd", label: "Efectivo Dólares (USD)", currency: "USD" },
  { id: "transfer-ars", label: "Transferencia Pesos (ARS)", currency: "ARS" },
];

const STORAGE_KEY = "nodo-cash-accounts";

function loadAccounts(): CashAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CashAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CASH_ACCOUNTS;
}

interface CashAccountsStore {
  accounts: CashAccount[];
  setAccounts: (accounts: CashAccount[]) => void;
  addAccount: (account: Omit<CashAccount, "id">) => void;
  removeAccount: (id: string) => void;
  resetAccounts: () => void;
}

export const useCashAccounts = create<CashAccountsStore>((set) => ({
  accounts: loadAccounts(),
  setAccounts: (accounts) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    set({ accounts });
  },
  addAccount: (account) =>
    set((state) => {
      const next = [
        ...state.accounts,
        { ...account, id: `acct-${Date.now()}` },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { accounts: next };
    }),
  removeAccount: (id) =>
    set((state) => {
      const next = state.accounts.filter((a) => a.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { accounts: next };
    }),
  resetAccounts: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CASH_ACCOUNTS));
    set({ accounts: DEFAULT_CASH_ACCOUNTS });
  },
}));
