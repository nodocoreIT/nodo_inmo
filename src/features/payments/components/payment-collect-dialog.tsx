import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, FileDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
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
import { useAuth } from "@/app/auth/use-auth";
import { supabase } from "@/shared/lib/supabase";
import { usePayments, type PaymentWithRelations } from "../hooks/use-payments";
import { useUpdatePayment } from "../hooks/use-update-payment";
import {
  assignCommissionAccount,
  useAnnulPayment,
  useDeletePayment,
} from "../hooks/use-delete-payment";
import { formatPeriod } from "../lib/payment-labels";
import { remainingAmount } from "@/features/dashboard/lib/dashboard-payment-utils";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import { formatCurrencyInput, parseCurrencyInput } from "@/shared/lib/format-money";
import { useCashAccounts } from "@/shared/hooks/use-cash-accounts";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { downloadPaymentReceipt } from "../lib/payment-receipt-pdf";
import { CASH_MOVEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-cash-movements";

const schema = z.object({
  periodMonth: z.string().min(1, "Mes requerido"),
  paidDate: z.string().min(1, "Fecha requerida"),
  amountReceived: z.string().min(1, "Monto requerido"),
  expensesAmount: z.string().optional(),
  commissionAccountId: z.string().min(1, "Elegí una cuenta"),
});

type FormValues = z.infer<typeof schema>;

interface PaymentCollectDialogProps {
  paymentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function contractLabel(payment: PaymentWithRelations): string {
  const tenant = payment.contract?.tenant?.name ?? "—";
  const address = payment.contract?.property?.address ?? "—";
  return `${tenant} — ${address}`;
}

function periodToMonthInput(period: string): string {
  return period.slice(0, 7);
}

function formatSubmitError(err: unknown): string {
  const raw =
    err instanceof Error && err.message
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";

  if (raw.includes("payments_contract_period_unique")) {
    return "Ya existe una cuota para ese mes en este contrato. Dejá el período de la cuota original.";
  }

  if (raw.length > 0) return raw;
  return "No se pudo guardar el cobro. Intentá de nuevo.";
}

async function resolveCommissionAccountId(
  paymentId: string,
  pool: { id: string; label: string }[],
): Promise<string | undefined> {
  const { data } = await supabase
    .schema("nodo_inmo")
    .from("cash_movements")
    .select("cash_account_id, category")
    .eq("payment_id", paymentId)
    .eq("source", "commission")
    .limit(1)
    .maybeSingle();

  if (data?.cash_account_id) return data.cash_account_id;
  if (data?.category) {
    return pool.find((a) => a.label === data.category)?.id;
  }
  return undefined;
}

export function PaymentCollectDialog({
  paymentId,
  open,
  onOpenChange,
  onSuccess,
}: PaymentCollectDialogProps) {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const { data: payments = [] } = usePayments();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const annulPayment = useAnnulPayment();
  const { accounts, isLoading: accountsLoading } = useCashAccounts();
  const { data: agency } = useOrgProfile();
  const payment = payments.find((p) => p.id === paymentId) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currency = (payment?.currency ?? "ARS") as "ARS" | "USD";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      periodMonth: "",
      paidDate: today,
      amountReceived: "",
      expensesAmount: "",
      commissionAccountId: "",
    },
  });

  const isPaid = payment?.status === "paid";

  useEffect(() => {
    if (!open || !payment) return;

    let cancelled = false;

    void (async () => {
      const defaultAmount = isPaid
        ? (payment.paid_amount ?? payment.amount)
        : payment.amount;

      const matchingAccounts = accounts.filter((a) => a.currency === currency);
      const pool = matchingAccounts.length > 0 ? matchingAccounts : accounts;

      const savedAccountId = isPaid
        ? await resolveCommissionAccountId(payment.id, pool)
        : undefined;

      const defaultAccount =
        (savedAccountId ? pool.find((a) => a.id === savedAccountId) : undefined) ??
        pool[0];

      if (cancelled) return;

      form.reset({
        periodMonth: periodToMonthInput(payment.period),
        paidDate: payment.paid_date ?? today,
        amountReceived: formatCurrencyInput(String(Math.round(defaultAmount)), currency),
        expensesAmount: "",
        commissionAccountId: defaultAccount?.id ?? "",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, payment, isPaid, accounts, currency, form, today]);

  async function handleSubmit(values: FormValues) {
    if (!payment || !orgId) return;
    setSubmitError(null);

    const account = accounts.find((a) => a.id === values.commissionAccountId);
    if (!account) {
      setSubmitError("Elegí una cuenta válida.");
      return;
    }

    const received = parseCurrencyInput(values.amountReceived) ?? 0;
    if (received <= 0) {
      setSubmitError("El monto recibido debe ser mayor a cero.");
      return;
    }

    const expenses = values.expensesAmount
      ? parseCurrencyInput(values.expensesAmount) ?? 0
      : 0;

    const periodMonth = periodToMonthInput(payment.period);
    const periodChanged = isPaid && values.periodMonth !== periodMonth;
    const newPeriod = `${values.periodMonth}-01`;

    if (periodChanged) {
      const conflict = payments.find(
        (p) =>
          p.id !== payment.id &&
          p.contract_id === payment.contract_id &&
          periodToMonthInput(p.period) === values.periodMonth,
      );
      if (conflict) {
        setSubmitError("Ya existe una cuota para ese mes en este contrato.");
        return;
      }
    }

    const alreadyPaid = isPaid ? 0 : (payment.paid_amount ?? 0);
    const newPaidTotal = alreadyPaid + received;
    const cobroAmount = isPaid ? received : Math.max(payment.amount, newPaidTotal);
    const isFullyPaid = isPaid || newPaidTotal >= payment.amount;

    try {
      await updatePayment.mutateAsync({
        id: payment.id,
        ...(periodChanged ? { period: newPeriod } : {}),
        amount: cobroAmount,
        status: isFullyPaid ? "paid" : "pending",
        paid_date: isFullyPaid ? values.paidDate : payment.paid_date,
        paid_amount: isFullyPaid ? cobroAmount : newPaidTotal,
        payment_method: "transfer",
      });

      if (isFullyPaid) {
        await assignCommissionAccount(payment.id, account.label, account.id);
      }

      if (expenses > 0) {
        const tenant = payment.contract?.tenant?.name ?? "Inquilino";
        const { error } = await supabase.schema("nodo_inmo").from("cash_movements").insert({
          org_id: orgId,
          type: "income",
          amount: expenses,
          currency: account.currency,
          date: values.paidDate,
          concept: `Expensas/Otros — ${tenant}`,
          category: account.label,
          cash_account_id: account.id,
          source: "manual",
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(formatSubmitError(err));
    }
  }

  async function handleDelete() {
    if (!payment) return;
    setDeleteError(null);
    try {
      if (payment.status === "paid") {
        await annulPayment.mutateAsync(payment.id);
      } else {
        await deletePayment.mutateAsync(payment.id);
      }
      setConfirmDelete(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo completar la operación. Verificá que la rendición no esté finalizada.";
      setDeleteError(msg);
    }
  }

  const deleteLabel =
    payment?.status === "paid" ? "Anular cobro" : "Eliminar cuota";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-navy">
              {isPaid ? "Modificar cobro" : "Registrar cobro"}
            </DialogTitle>
            <DialogDescription>
              {isPaid
                ? "Corregí el mes, monto o cuenta de comisión. Podés anular el cobro si fue un error."
                : "Completá el mes pagado, monto del alquiler, expensas/otros (opcional) y cuenta."}
            </DialogDescription>
          </DialogHeader>

          {!payment ? (
            <p className="text-sm text-slate2">No se encontró la cuota seleccionada.</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate2">
                    Contrato
                  </p>
                  <p className="rounded-md border border-border bg-mist/40 px-3 py-2 text-sm font-medium text-navy">
                    {contractLabel(payment)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="periodMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wide text-slate2">
                          Mes de la cuota
                        </FormLabel>
                        <FormControl>
                          {isPaid ? (
                            <Input type="month" {...field} />
                          ) : (
                            <p className="rounded-md border border-border bg-mist/40 px-3 py-2 text-sm text-navy">
                              {formatPeriod(payment.period)}
                            </p>
                          )}
                        </FormControl>
                        <p className="text-2xs text-slate2">
                          Período: {formatPeriod(`${isPaid ? field.value : periodToMonthInput(payment.period)}-01`)}
                        </p>
                        {!isPaid ? (
                          <p className="text-2xs text-slate2">
                            Corresponde a esta cuota; no se puede cambiar al cobrar.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate2">
                      Vencimiento
                    </p>
                    <p className="rounded-md border border-border bg-mist/40 px-3 py-2 text-sm text-navy">
                      {formatDate(payment.due_date)}
                    </p>
                  </div>
                </div>

                {!isPaid ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate2">
                        Alquiler pactado
                      </p>
                      <p className="text-sm font-semibold text-navy">
                        {formatMoney(payment.amount, payment.currency)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate2">
                        Saldo pendiente
                      </p>
                      <p className="text-lg font-bold text-destructive">
                        {formatMoney(remainingAmount(payment), payment.currency)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="paidDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de cobro</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amountReceived"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto recibido (alquiler)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
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
                  control={form.control}
                  name="expensesAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expensas / Otros (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder={currency === "USD" ? "US$ 0 — vacío si no aplica" : "$ 0 — vacío si no aplica"}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            field.onChange(
                              raw ? formatCurrencyInput(raw, currency) : "",
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commissionAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿A qué cuenta va mi comisión?</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={accountsLoading || accounts.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Elegí una cuenta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.label}
                              {account.currency === "USD" ? " · US$" : " · $"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {accounts.length === 0 && !accountsLoading ? (
                        <p className="text-xs text-destructive">
                          No hay cuentas. Agregalas en Configuración → Cuentas bancarias.
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {submitError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {isPaid ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => payment && void downloadPaymentReceipt(payment, agency ?? null)}
                      >
                        <FileDown className="h-4 w-4" />
                        Descargar recibo
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteLabel}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-brand text-white"
                      disabled={updatePayment.isPending || accountsLoading || accounts.length === 0}
                    >
                      {updatePayment.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando…
                        </>
                      ) : (
                        "Guardar cobro"
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open);
          if (!open) setDeleteError(null);
        }}
      >
        <AlertDialogContent className="mx-4 w-[calc(100%-2rem)] max-w-sm sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {payment?.status === "paid" ? "¿Anular este cobro?" : "¿Eliminar esta cuota?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {payment?.status === "paid"
                ? "El cobro volverá a pendiente y se quitará la comisión de caja y la rendición pendiente al propietario."
                : "La cuota se borrará del contrato. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletePayment.isPending || annulPayment.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deletePayment.isPending || annulPayment.isPending
                ? "Procesando…"
                : deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
