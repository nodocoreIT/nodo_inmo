/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
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
import { useCreateExpense } from "@/features/property-expenses/hooks/use-create-expense";
import { useUploadReceipt } from "@/features/property-expenses/hooks/use-upload-receipt";

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  type: z.enum(["arreglo", "compra_accesorio"], {
    required_error: "Tipo requerido",
  }),
  amount: z
    .string()
    .min(1, "Monto requerido")
    .refine((v) => Number(v) > 0, "El monto debe ser mayor a cero"),
  currency: z.enum(["ARS", "USD"]),
  expense_date: z.string().min(1, "Fecha requerida"),
  description: z.string().min(1, "Descripción requerida"),
  charged_to_owner: z.boolean({
    required_error: "Indicá si se le cobra al propietario",
  }),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onSuccess?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExpenseFormDialog({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: ExpenseFormDialogProps) {
  const { mutateAsync: createExpense, isPending: isCreating } = useCreateExpense();
  const { mutateAsync: uploadReceipt, isPending: isUploading } = useUploadReceipt();
  const isPending = isCreating || isUploading;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      type: undefined as any,
      amount: "",
      currency: "ARS",
      expense_date: today,
      description: "",
      charged_to_owner: undefined as any,
    },
  });

  async function handleSubmit(values: FormValues) {
    setErrorMessage(null);

    try {
      let receiptPath: string | undefined;

      // Upload receipt first (R24 — upload before insert)
      if (receiptFile) {
        receiptPath = await uploadReceipt({
          propertyId,
          file: receiptFile,
        });
        // Ensure the returned key is never a URL (R20)
        if (receiptPath?.startsWith("http")) {
          throw new Error("Storage returned a URL instead of an object key");
        }
      }

      await createExpense({
        property_id: propertyId,
        type: values.type,
        amount: Number(values.amount),
        currency: values.currency,
        expense_date: values.expense_date,
        description: values.description,
        charged_to_owner: values.charged_to_owner,
        receipt_path: receiptPath ?? null,
      });

      // Success path (R25)
      form.reset();
      setReceiptFile(null);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      // Failure path (R25) — show error, keep dialog open
      setErrorMessage(
        err instanceof Error ? err.message : "Error al registrar el gasto. Intentá de nuevo.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
          <DialogDescription>
            Cargá un gasto asociado a la propiedad.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            {/* Type + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="expense-type-trigger">Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          id="expense-type-trigger"
                          aria-label="Tipo de gasto"
                        >
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="arreglo">Arreglo</SelectItem>
                        <SelectItem value="compra_accesorio">
                          Compra de accesorio
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="expense-currency-trigger">Moneda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          id="expense-currency-trigger"
                          aria-label="Moneda"
                        >
                          <SelectValue placeholder="ARS" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ARS">ARS ($)</SelectItem>
                        <SelectItem value="USD">USD (U$S)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="expense-amount-input">Monto</FormLabel>
                    <FormControl>
                      <Input
                        id="expense-amount-input"
                        aria-label="Monto"
                        type="number"
                        min={0.01}
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="expense_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="expense-date-input">Fecha</FormLabel>
                    <FormControl>
                      <Input
                        id="expense-date-input"
                        aria-label="Fecha"
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control as any}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="expense-description-input">Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      id="expense-description-input"
                      aria-label="Descripción"
                      placeholder="Describí el gasto brevemente"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* charged_to_owner — required, no default (ADR-4) */}
            <FormField
              control={form.control as any}
              name="charged_to_owner"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <input
                        id="expense-charged-to-owner"
                        type="checkbox"
                        aria-label="A cargo del propietario"
                        checked={field.value === true}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded-sm border border-input accent-brand focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="expense-charged-to-owner"
                      className="cursor-pointer text-sm font-normal"
                    >
                      A cargo del propietario
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Receipt photo upload — optional (R16, R19, R20) */}
            <FormItem>
              <FormLabel htmlFor="expense-receipt-input">
                Comprobante (opcional)
              </FormLabel>
              <FormControl>
                <Input
                  id="expense-receipt-input"
                  aria-label="Comprobante"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
              </FormControl>
            </FormItem>

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
