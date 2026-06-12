/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
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
import { useProperties } from "@/features/properties/hooks/use-properties";
import { useContacts } from "@/features/contacts/hooks/use-contacts";
import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";
import { formatCurrencyInput, parseCurrencyInput } from "@/shared/lib/format-money";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  property_id: z.string().min(1, "Seleccioná una propiedad"),
  tenant_id: z.string().min(1, "Seleccioná un inquilino"),
  start_date: z.string().min(1, "Fecha de inicio requerida"),
  end_date: z.string().min(1, "Fecha de fin requerida"),
  rent_amount: z.string().min(1, "Monto requerido"),
  currency: z.enum(["ARS", "USD"]),
  deposit_amount: z.string().optional(),
  commission_rate: z.string().optional(),
  expenses_paid_by: z.enum(["tenant", "owner"]),
  adjustment_index: z.enum(["IPC", "ICL", "fixed", "USD"]),
  adjustment_period_months: z.string().min(1, "Periodicidad requerida"),
  status: z.enum(["draft", "active", "terminated", "expired"]),
  notes: z.string().optional(),
  // Phase C — contract generator metadata
  contract_type: z.enum(["habitacional", "comercial"]),
  signing_date: z.string().optional(),
});

export type ContractFormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toStr(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function commissionRateFromContract(contract?: ContractWithRelations): string {
  if (!contract?.commission_amount || !contract.rent_amount) return "10";
  const rate = (contract.commission_amount / contract.rent_amount) * 100;
  return String(Math.round(rate * 100) / 100);
}

function buildPayload(values: ContractFormValues, guarantorIds: string[]) {
  const rent = parseCurrencyInput(values.rent_amount) || 0;
  const rate = Number(values.commission_rate?.replace(",", ".") || 0);
  const commissionAmount =
    rent > 0 && rate > 0 ? Math.round((rent * rate) / 100) : null;

  return {
    property_id: values.property_id,
    tenant_id: values.tenant_id,
    start_date: values.start_date,
    end_date: values.end_date,
    rent_amount: rent,
    currency: values.currency,
    deposit_amount: parseCurrencyInput(values.deposit_amount),
    commission_amount: commissionAmount,
    expenses_paid_by: values.expenses_paid_by,
    adjustment_index: values.adjustment_index,
    adjustment_period_months: Number(values.adjustment_period_months),
    status: values.status,
    notes: values.notes || null,
    guarantor_ids: guarantorIds,
    contract_type: values.contract_type,
    signing_date: values.signing_date || null,
    signing_city: null,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog is in edit mode and prefills from this contract. */
  contract?: ContractWithRelations;
  onSuccess?: () => void;
  onSubmit: (values: ReturnType<typeof buildPayload>) => Promise<void>;
  isPending?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractFormDialog({
  open,
  onOpenChange,
  contract,
  onSuccess,
  onSubmit,
  isPending = false,
}: ContractFormDialogProps) {
  const isEdit = !!contract;
  const { data: properties = [] } = useProperties();
  const { data: tenants = [] } = useContacts("tenant");
  const { data: guarantors = [] } = useContacts("guarantor");

  const [guarantorIds, setGuarantorIds] = useState<string[]>(
    contract?.guarantors?.map((g) => g.guarantor_id) ?? [],
  );

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      property_id: contract?.property_id ?? "",
      tenant_id: contract?.tenant_id ?? "",
      start_date: contract?.start_date ?? "",
      end_date: contract?.end_date ?? "",
      rent_amount: formatCurrencyInput(contract?.rent_amount, contract?.currency as any ?? "ARS"),
      currency: (contract?.currency as any) ?? "ARS",
      deposit_amount: formatCurrencyInput(contract?.deposit_amount, contract?.currency as any ?? "ARS"),
      commission_rate: commissionRateFromContract(contract),
      expenses_paid_by: (contract?.expenses_paid_by as any) ?? "tenant",
      adjustment_index: (contract?.adjustment_index as any) ?? "IPC",
      adjustment_period_months: toStr(contract?.adjustment_period_months) || "12",
      status: (contract?.status as any) ?? "active",
      notes: contract?.notes ?? "",
      // Phase C — contract generator metadata
      contract_type: (contract?.contract_type as any) ?? "habitacional",
      signing_date: contract?.signing_date ?? "",
    },
  });

  const currency = form.watch("currency") || "ARS";
  const rentAmount = form.watch("rent_amount") || "";
  const commissionRate = form.watch("commission_rate") || "";
  const computedCommission = useMemo(() => {
    const rent = parseCurrencyInput(rentAmount) ?? 0;
    const rate = Number(commissionRate.replace(",", "."));
    if (!rent || !rate) return null;
    return Math.round((rent * rate) / 100);
  }, [rentAmount, commissionRate]);
  const prevCurrencyRef = useRef(currency);
  useEffect(() => {
    if (prevCurrencyRef.current !== currency) {
      const rent = form.getValues("rent_amount");
      const deposit = form.getValues("deposit_amount");

      if (rent) {
        form.setValue("rent_amount", formatCurrencyInput(rent.replace(/\D/g, ""), currency));
      }
      if (deposit) {
        form.setValue("deposit_amount", formatCurrencyInput(deposit.replace(/\D/g, ""), currency));
      }
      prevCurrencyRef.current = currency;
    }
  }, [currency, form]);

  function toggleGuarantor(id: string) {
    setGuarantorIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  async function handleSubmit(values: ContractFormValues) {
    await onSubmit(buildPayload(values, guarantorIds));
    if (!isEdit) {
      form.reset();
      setGuarantorIds([]);
    }
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar contrato" : "Nuevo contrato"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los datos del contrato y guardá los cambios."
              : "Completá los datos del contrato de alquiler."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            {/* Property */}
            <FormField
              control={form.control as any}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="property-select">Propiedad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger id="property-select" aria-label="Propiedad">
                        <SelectValue placeholder="Seleccioná" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tenant */}
            <FormField
              control={form.control as any}
              name="tenant_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="tenant-select">Inquilino</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger id="tenant-select" aria-label="Inquilino">
                        <SelectValue placeholder="Seleccioná" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="start-date-input">Inicio</FormLabel>
                    <FormControl>
                      <Input
                        id="start-date-input"
                        aria-label="Inicio"
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="end-date-input">Fin</FormLabel>
                    <FormControl>
                      <Input
                        id="end-date-input"
                        aria-label="Fin"
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Rent + currency */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="rent_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rent-input">Alquiler</FormLabel>
                    <FormControl>
                      <Input
                        id="rent-input"
                        aria-label="Alquiler"
                        type="text"
                        placeholder={currency === "ARS" ? "$ 0" : "US$ 0"}
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
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="currency-trigger">Moneda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger id="currency-trigger" aria-label="Moneda">
                          <SelectValue placeholder="ARS" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ARS">ARS</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Deposit + commission */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="deposit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="deposit-input">Depósito</FormLabel>
                    <FormControl>
                      <Input
                        id="deposit-input"
                        aria-label="Depósito"
                        type="text"
                        placeholder={currency === "ARS" ? "$ 0" : "US$ 0"}
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
                name="commission_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="commission-input">Comisión (%)</FormLabel>
                    <FormControl>
                      <Input
                        id="commission-input"
                        aria-label="Comisión porcentaje"
                        type="text"
                        inputMode="decimal"
                        placeholder="10"
                        value={field.value}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
                          field.onChange(raw);
                        }}
                      />
                    </FormControl>
                    {computedCommission != null ? (
                      <p className="text-xs text-slate2">
                        ≈ {formatCurrencyInput(String(computedCommission), currency)} según el alquiler
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Adjustment index + period */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="adjustment_index"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="index-trigger">Índice de ajuste</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger id="index-trigger" aria-label="Índice de ajuste">
                          <SelectValue placeholder="IPC" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="IPC">IPC</SelectItem>
                        <SelectItem value="ICL">ICL</SelectItem>
                        <SelectItem value="fixed">Fijo</SelectItem>
                        <SelectItem value="USD">Dólar</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="adjustment_period_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="period-input">Ajuste (meses)</FormLabel>
                    <FormControl>
                      <Input
                        id="period-input"
                        aria-label="Ajuste (meses)"
                        type="number"
                        min={1}
                        placeholder="12"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Expenses + status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="expenses_paid_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="expenses-trigger">Expensas a cargo de</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger id="expenses-trigger" aria-label="Expensas a cargo de">
                          <SelectValue placeholder="Inquilino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tenant">Inquilino</SelectItem>
                        <SelectItem value="owner">Propietario</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="status-trigger">Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger id="status-trigger" aria-label="Estado">
                          <SelectValue placeholder="Borrador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Borrador</SelectItem>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="terminated">Rescindido</SelectItem>
                        <SelectItem value="expired">Vencido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Datos del contrato (Phase C) */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Datos del contrato</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="contract-type-trigger">Tipo de contrato</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id="contract-type-trigger" aria-label="Tipo de contrato">
                            <SelectValue placeholder="Habitacional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="habitacional">Habitacional</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="signing_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="signing-date-input">Fecha de firma</FormLabel>
                      <FormControl>
                        <Input
                          id="signing-date-input"
                          aria-label="Fecha de firma"
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Guarantors (multi-select via checkboxes) */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Garantes</legend>
              {guarantors.length === 0 && (
                <p className="text-xs text-slate2">
                  No hay contactos con rol garante todavía.
                </p>
              )}
              {guarantors.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <input
                    id={`guarantor-${g.id}`}
                    type="checkbox"
                    className="h-4 w-4 rounded border-mist text-brand"
                    checked={guarantorIds.includes(g.id)}
                    onChange={() => toggleGuarantor(g.id)}
                  />
                  <Label htmlFor={`guarantor-${g.id}`} className="font-normal">
                    {g.name}
                  </Label>
                </div>
              ))}
            </fieldset>

            {/* Notes */}
            <FormField
              control={form.control as any}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="notes-input">Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      id="notes-input"
                      aria-label="Notas"
                      placeholder="Observaciones del contrato…"
                      rows={2}
                      {...field}
                    />
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
              <Button type="submit" disabled={isPending}>
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
