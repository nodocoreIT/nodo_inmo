/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { useCreateCashMovement } from "@/features/caja/hooks/use-create-cash-movement";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.string().min(1, "Monto requerido"),
  concept: z.string().min(1, "Concepto requerido"),
  date: z.string().min(1, "Fecha requerida"),
});

type FormValues = z.infer<typeof schema>;

interface MovementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MovementFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: MovementFormDialogProps) {
  const { mutateAsync, isPending } = useCreateCashMovement();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { type: "expense", amount: "", concept: "", date: today },
  });

  async function handleSubmit(values: FormValues) {
    await mutateAsync({
      type: values.type,
      amount: parseCurrencyInput(values.amount) || 0,
      concept: values.concept,
      date: values.date,
    });
    form.reset({ type: "expense", amount: "", concept: "", date: today });
    onSuccess?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <DialogDescription>
            Registrá un ingreso o egreso manual de la caja.
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="amount-input">Monto</FormLabel>
                    <FormControl>
                      <Input
                        id="amount-input"
                        aria-label="Monto"
                        type="text"
                        placeholder="$ 0"
                        value={field.value}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          field.onChange(formatCurrencyInput(raw, "ARS"));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control as any}
              name="concept"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="concept-input">Concepto</FormLabel>
                  <FormControl>
                    <Input
                      id="concept-input"
                      aria-label="Concepto"
                      placeholder="Ej: Gastos de oficina"
                      {...field}
                    />
                  </FormControl>
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
