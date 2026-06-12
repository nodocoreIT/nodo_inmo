/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { formatCurrencyInput, parseCurrencyInput } from "@/shared/lib/format-money";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { CreatableCombobox } from "@/shared/components/ui/creatable-combobox";
import { useCreateCashMovement } from "@/features/caja/hooks/use-create-cash-movement";
import { useUpdateCashMovement } from "@/features/caja/hooks/use-update-cash-movement";
import { useConceptos, useCreateConcepto } from "@/features/caja/hooks/use-conceptos";
import type { CashMovementRow } from "@/features/caja/hooks/use-cash-movements";
import { useCashAccounts, type CashAccount } from "@/shared/hooks/use-cash-accounts";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  accountId: z.string().min(1, "Elegí una cuenta"),
  amount: z.string().min(1, "Monto requerido"),
  concept: z.string().min(1, "Concepto requerido"),
  destinationAccountId: z.string().optional(),
  date: z.string().min(1, "Fecha requerida"),
});

type FormValues = z.infer<typeof schema>;

interface MovementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  movement?: CashMovementRow | null;
}

function resolveAccountId(
  movement: CashMovementRow,
  accounts: CashAccount[],
  field: "cash_account_id" | "destination_account_id",
  labelField: "category" | "destination_category",
): string {
  const id = movement[field];
  if (id) return id;
  const label = movement[labelField];
  if (!label) return "";
  return accounts.find((a) => a.label === label)?.id ?? "";
}

function movementToFormValues(
  movement: CashMovementRow,
  accounts: CashAccount[],
): FormValues {
  const currency = (movement.currency as "ARS" | "USD") ?? "ARS";
  return {
    type: movement.type as "income" | "expense",
    accountId: resolveAccountId(movement, accounts, "cash_account_id", "category"),
    amount: formatCurrencyInput(String(Math.round(movement.amount)), currency),
    concept: movement.concept,
    destinationAccountId: resolveAccountId(
      movement,
      accounts,
      "destination_account_id",
      "destination_category",
    ),
    date: movement.date,
  };
}

export function MovementFormDialog({
  open,
  onOpenChange,
  onSuccess,
  movement,
}: MovementFormDialogProps) {
  const isEdit = !!movement;
  const createMovement = useCreateCashMovement();
  const updateMovement = useUpdateCashMovement();
  const { accounts, isLoading: accountsLoading } = useCashAccounts();
  const { data: conceptos = [], isLoading: conceptosLoading } = useConceptos();
  const createConcepto = useCreateConcepto();
  const today = new Date().toISOString().slice(0, 10);
  const isPending = createMovement.isPending || updateMovement.isPending;

  const conceptOptions = useMemo(
    () => conceptos.map((c) => c.name),
    [conceptos],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      type: "expense",
      accountId: "",
      amount: "",
      concept: "",
      destinationAccountId: "",
      date: today,
    },
  });

  const accountId = form.watch("accountId");
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const currency = selectedAccount?.currency ?? "ARS";

  const destinationAccounts = useMemo(
    () => accounts.filter((a) => a.id !== accountId),
    [accounts, accountId],
  );

  useEffect(() => {
    if (!open || accountsLoading) return;

    if (movement) {
      form.reset(movementToFormValues(movement, accounts));
      return;
    }

    form.reset({
      type: "expense",
      accountId: accounts[0]?.id ?? "",
      amount: "",
      concept: "",
      destinationAccountId: "",
      date: today,
    });
  }, [open, movement, accounts, accountsLoading, form, today]);

  useEffect(() => {
    const current = form.getValues("amount");
    if (current) {
      const raw = current.replace(/\D/g, "");
      form.setValue("amount", formatCurrencyInput(raw, currency));
    }
  }, [currency, form]);

  async function resolveConceptoId(conceptName: string): Promise<string | null> {
    const trimmed = conceptName.trim();
    const concepto = conceptos.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (concepto) return concepto.id;
    const created = await createConcepto.mutateAsync(trimmed);
    return created.id;
  }

  async function handleSubmit(values: FormValues) {
    const account = accounts.find((a) => a.id === values.accountId);
    if (!account) return;

    const destAccount = values.destinationAccountId
      ? accounts.find((a) => a.id === values.destinationAccountId)
      : undefined;

    const conceptoId = await resolveConceptoId(values.concept);

    const payload = {
      type: values.type,
      amount: parseCurrencyInput(values.amount) || 0,
      concept: values.concept.trim(),
      date: values.date,
      currency: account.currency,
      category: account.label,
      cash_account_id: account.id,
      destination_account_id: destAccount?.id ?? null,
      destination_category: destAccount?.label ?? null,
      concepto_id: conceptoId,
    };

    if (isEdit && movement) {
      await updateMovement.mutateAsync({ id: movement.id, ...payload });
    } else {
      await createMovement.mutateAsync(payload);
    }

    onSuccess?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los datos del movimiento manual."
              : "Registrá un ingreso o egreso manual de la caja."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="type-trigger">Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger id="type-trigger" aria-label="Tipo">
                          <SelectValue placeholder="Egreso" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Ingreso</SelectItem>
                        <SelectItem value="expense">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={accountsLoading || accounts.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Cuenta">
                          <SelectValue placeholder="Elegí cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control as any}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="amount-input">Monto</FormLabel>
                  <FormControl>
                    <Input
                      id="amount-input"
                      aria-label="Monto"
                      type="text"
                      placeholder={currency === "USD" ? "US$ 0" : "$ 0"}
                      value={field.value}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        field.onChange(formatCurrencyInput(raw, currency));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="concept"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="concept-combobox">Concepto</FormLabel>
                  <FormControl>
                    <CreatableCombobox
                      id="concept-combobox"
                      aria-label="Concepto"
                      options={conceptOptions}
                      value={field.value}
                      onChange={field.onChange}
                      onCreateOption={async (name) => {
                        await createConcepto.mutateAsync(name);
                      }}
                      isCreating={createConcepto.isPending}
                      placeholder="Elegí o creá un concepto"
                      searchPlaceholder="Buscar concepto..."
                      disabled={conceptosLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="destinationAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caja destino</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={accountsLoading || destinationAccounts.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Caja destino">
                        <SelectValue placeholder="Opcional — elegí cuenta destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {destinationAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="date-input">Fecha</FormLabel>
                  <FormControl>
                    <Input id="date-input" aria-label="Fecha" type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || accountsLoading}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
