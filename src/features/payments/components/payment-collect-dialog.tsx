import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2 } from "lucide-react";
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
import { FileDown } from "lucide-react";

const schema = z.object({
  periodMonth: z.string().min(1, "Mes requerido"),
  paidDate: z.string().min(1, "Fecha requerida"),
  amountReceived: z.string().min(1, "Monto requerido"),
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

function findAccountIdByLabel(
  accounts: { id: string; label: string }[],
  label: string | null | undefined,
): string {
  if (!label) return accounts[0]?.id ?? "";
  return accounts.find((a) => a.label === label)?.id ?? accounts[0]?.id ?? "";
}

export function PaymentCollectDialog({
  paymentId,
  open,
  onOpenChange,
  onSuccess,
}: PaymentCollectDialogProps) {
  const { data: payments = [] } = usePayments();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const annulPayment = useAnnulPayment();
  const { accounts } = useCashAccounts();
  const { data: agency } = useOrgProfile();
  const payment = payments.find((p) => p.id === paymentId) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currency = (payment?.currency ?? "ARS") as "ARS" | "USD";
  const currencyAccounts = useMemo(
    () => accounts.filter((a) => a.currency === currency),
    [accounts, currency],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      periodMonth: "",
      paidDate: today,
      amountReceived: "",
      commissionAccountId: "",
    },
  });

  const isPaid = payment?.status === "paid";

  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (!payment || wasOpen.current) return;
    wasOpen.current = true;

    const balance = isPaid
      ? (payment.paid_amount ?? payment.amount)
      : remainingAmount(payment);
    const defaultAccount =
      currencyAccounts.find((a) => a.id === findAccountIdByLabel(currencyAccounts, payment.payment_method)) ??
      currencyAccounts[0];

    form.reset({
      periodMonth: periodToMonthInput(payment.period),
      paidDate: payment.paid_date ?? today,
      amountReceived: formatCurrencyInput(String(balance)),
      commissionAccountId: defaultAccount?.id ?? "",
    });
  }, [open, payment, isPaid, currencyAccounts, form, today]);

  async function handleSubmit(values: FormValues) {
    if (!payment) return;

    const account = currencyAccounts.find((a) => a.id === values.commissionAccountId);
    if (!account) return;

    const received = parseCurrencyInput(values.amountReceived) ?? 0;
    const period = `${values.periodMonth}-01`;
    const alreadyPaid = isPaid ? 0 : (payment.paid_amount ?? 0);
    const newPaidTotal = alreadyPaid + received;
    const isFullyPaid = newPaidTotal >= payment.amount;

    await updatePayment.mutateAsync({
      id: payment.id,
      period,
      status: isFullyPaid ? "paid" : "pending",
      paid_date: values.paidDate,
      paid_amount: isFullyPaid ? payment.amount : newPaidTotal,
      payment_method: account.label,
    });

    if (isFullyPaid) {
      await assignCommissionAccount(payment.id, account.label);
    }

    onSuccess?.();
    onOpenChange(false);
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
                : "Completá el mes pagado, monto y cuenta donde va la comisión."}
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
                          Mes pagado
                        </FormLabel>
                        <FormControl>
                          <Input type="month" {...field} />
                        </FormControl>
                        <p className="text-2xs text-slate2">
                          Período: {formatPeriod(`${field.value}-01`)}
                        </p>
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
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate2">
                      Saldo pendiente
                    </p>
                    <p className="text-lg font-bold text-destructive">
                      {formatMoney(remainingAmount(payment), payment.currency)}
                    </p>
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
                      <FormLabel>Monto recibido</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(formatCurrencyInput(e.target.value))
                          }
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Elegí una cuenta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencyAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      disabled={updatePayment.isPending}
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
        <AlertDialogContent>
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
