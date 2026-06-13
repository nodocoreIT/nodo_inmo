import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from "@/shared/lib/format-money";
import {
  useCashAccounts,
  type BankAccountInput,
  type CashAccount,
} from "@/shared/hooks/use-cash-accounts";
import { formatMoney } from "@/features/contracts/lib/contract-labels";

const EMPTY_FORM: BankAccountInput & { initial_balance_input: string } = {
  bank_name: "",
  alias: "",
  cbu: "",
  currency: "ARS",
  initial_balance_input: "",
};

function accountToForm(account: CashAccount): typeof EMPTY_FORM {
  return {
    bank_name: account.bank_name ?? account.label,
    alias: account.alias ?? "",
    cbu: account.cbu ?? "",
    currency: account.currency,
    initial_balance_input:
      account.initial_balance && account.initial_balance > 0
        ? formatCurrencyInput(String(Math.round(account.initial_balance)), account.currency)
        : "",
  };
}

export function BankAccountsSection() {
  const {
    accounts,
    isLoading,
    addAccount,
    updateAccount,
    removeAccount,
    isAdding,
    isUpdating,
    isRemoving,
  } = useCashAccounts();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const isEdit = editingId !== null;
  const isSaving = isAdding || isUpdating;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(account: CashAccount) {
    setEditingId(account.id);
    setForm(accountToForm(account));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bank_name.trim() || !form.cbu.trim()) return;

    const initialBalance = form.initial_balance_input
      ? parseCurrencyInput(form.initial_balance_input) ?? 0
      : 0;

    const payload: BankAccountInput = {
      bank_name: form.bank_name.trim(),
      alias: form.alias?.trim(),
      cbu: form.cbu.trim(),
      currency: form.currency,
      initial_balance: isEdit ? undefined : initialBalance,
    };

    if (isEdit && editingId) {
      await updateAccount({ id: editingId, ...payload });
    } else {
      await addAccount(payload);
    }
    closeForm();
  }

  return (
    <div className="border-t border-border pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-navy">Cuentas bancarias</h3>
          <p className="text-xs text-slate2">
            Usadas en cobros, movimientos de caja y liquidaciones.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Agregar cuenta
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mb-4 grid grid-cols-1 gap-4 rounded-md border border-border bg-paper p-4 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <Label htmlFor="bank-name">Banco</Label>
            <Input
              id="bank-name"
              placeholder="Ej. Banco Galicia"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bank-alias">Alias</Label>
            <Input
              id="bank-alias"
              placeholder="Ej. NODO.INMO"
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bank-cbu">CBU/CVU</Label>
            <Input
              id="bank-cbu"
              placeholder="22 dígitos"
              value={form.cbu}
              onChange={(e) => setForm({ ...form, cbu: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => {
                const currency = v as "ARS" | "USD";
                setForm({
                  ...form,
                  currency,
                  initial_balance_input: form.initial_balance_input
                    ? formatCurrencyInput(
                        form.initial_balance_input.replace(/\D/g, ""),
                        currency,
                      )
                    : "",
                });
              }}
            >
              <SelectTrigger aria-label="Moneda">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">Pesos ($)</SelectItem>
                <SelectItem value="USD">Dólares (US$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isEdit && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="bank-initial">Monto inicial (opcional)</Label>
              <Input
                id="bank-initial"
                placeholder={form.currency === "USD" ? "US$ 0" : "$ 0"}
                value={form.initial_balance_input}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({
                    ...form,
                    initial_balance_input: formatCurrencyInput(raw, form.currency),
                  });
                }}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Confirmar"}
            </Button>
          </div>
        </form>
      )}

      {isLoading && (
        <p className="py-6 text-center text-sm text-slate2">Cargando cuentas…</p>
      )}

      {!isLoading && accounts.length === 0 && !showForm && (
        <p className="py-6 text-center text-sm text-slate2">
          No hay cuentas bancarias registradas.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-start justify-between rounded-md border border-border bg-card p-4"
          >
            <div className="space-y-1">
              <p className="text-sm font-bold text-navy">
                {account.bank_name ?? account.label}
              </p>
              <p className="text-xs text-slate2">
                <strong>Moneda:</strong>{" "}
                {account.currency === "USD" ? "Dólares (US$)" : "Pesos ($)"}
              </p>
              <p className="text-xs text-slate2">
                <strong>Alias:</strong> {account.alias || "—"}
              </p>
              <p className="font-mono text-xs text-slate2">
                <strong>CBU:</strong> {account.cbu || "—"}
              </p>
              {(account.initial_balance ?? 0) > 0 && (
                <p className="text-xs text-green-700">
                  <strong>Saldo inicial:</strong>{" "}
                  {formatMoney(account.initial_balance!, account.currency)}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => openEdit(account)}
                className="rounded-md p-1.5 text-slate2 transition-colors hover:bg-mist hover:text-navy"
                aria-label={`Editar ${account.bank_name ?? account.label}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={isRemoving}
                onClick={() => void removeAccount(account.id)}
                className="rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                aria-label={`Eliminar ${account.bank_name ?? account.label}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
