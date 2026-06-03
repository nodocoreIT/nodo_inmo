/* eslint-disable @typescript-eslint/no-explicit-any */
import { useForm } from "react-hook-form";
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
import type { OwnerRow } from "@/features/owners/hooks/use-owners";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  dni: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  // String input — coerced on submit
  commission_rate: z.string().optional(),
  can_view_rentals: z.boolean(),
  can_view_construction: z.boolean(),
  can_view_sales: z.boolean(),
});

export type OwnerFormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNumberOrDefault(v: string | undefined | null, def: number): number {
  if (!v || String(v).trim() === "") return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function buildPayload(values: OwnerFormValues) {
  return {
    name: values.name,
    dni: values.dni || null,
    phone: values.phone || null,
    email: values.email || null,
    address: values.address || null,
    commission_rate: toNumberOrDefault(values.commission_rate, 10),
    can_view_rentals: values.can_view_rentals,
    can_view_construction: values.can_view_construction,
    can_view_sales: values.can_view_sales,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface OwnerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog is in edit mode and prefills the form */
  owner?: OwnerRow;
  /** Called after a successful submit */
  onSuccess?: () => void;
  /** Called when the form values should be persisted */
  onSubmit: (
    values: ReturnType<typeof buildPayload>,
    owner?: OwnerRow,
  ) => Promise<void>;
  isPending?: boolean;
}

// ── Checkbox component (no @radix-ui/react-checkbox dep) ─────────────────────

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxField({ id, label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-sm"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-sm border border-input accent-brand focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={label}
      />
      {label}
    </label>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OwnerFormDialog({
  open,
  onOpenChange,
  owner,
  onSuccess,
  onSubmit,
  isPending = false,
}: OwnerFormDialogProps) {
  const isEdit = !!owner;

  const form = useForm<OwnerFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: owner?.name ?? "",
      dni: owner?.dni ?? "",
      phone: owner?.phone ?? "",
      email: owner?.email ?? "",
      address: owner?.address ?? "",
      commission_rate: owner?.commission_rate != null
        ? String(owner.commission_rate)
        : "10",
      can_view_rentals: owner?.can_view_rentals ?? false,
      can_view_construction: owner?.can_view_construction ?? false,
      can_view_sales: owner?.can_view_sales ?? false,
    },
  });

  async function handleSubmit(values: OwnerFormValues) {
    await onSubmit(buildPayload(values), owner);
    if (!isEdit) form.reset();
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar propietario" : "Nuevo propietario"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los campos y guardá los cambios."
              : "Completá los campos para registrar un nuevo propietario."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            {/* Name */}
            <FormField
              control={form.control as any}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="owner-name-input">Nombre</FormLabel>
                  <FormControl>
                    <Input
                      id="owner-name-input"
                      aria-label="Nombre"
                      placeholder="María García"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* DNI + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="owner-dni-input">DNI</FormLabel>
                    <FormControl>
                      <Input
                        id="owner-dni-input"
                        aria-label="DNI"
                        placeholder="20-12345678-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="owner-phone-input">Teléfono</FormLabel>
                    <FormControl>
                      <Input
                        id="owner-phone-input"
                        aria-label="Teléfono"
                        placeholder="11-5555-0001"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email + Commission */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="owner-email-input">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="owner-email-input"
                        aria-label="Email"
                        type="email"
                        placeholder="propietario@mail.com"
                        {...field}
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
                    <FormLabel htmlFor="owner-commission-input">
                      Comisión (%)
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="owner-commission-input"
                        aria-label="Comisión (%)"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <FormField
              control={form.control as any}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="owner-address-input">Dirección</FormLabel>
                  <FormControl>
                    <Input
                      id="owner-address-input"
                      aria-label="Dirección"
                      placeholder="Av. Corrientes 1234"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Permissions */}
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <p className="text-xs font-medium text-slate2">
                Acceso al portal del propietario
              </p>

              <FormField
                control={form.control as any}
                name="can_view_rentals"
                render={({ field }) => (
                  <CheckboxField
                    id="owner-can-view-rentals"
                    label="Ver alquileres"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <FormField
                control={form.control as any}
                name="can_view_construction"
                render={({ field }) => (
                  <CheckboxField
                    id="owner-can-view-construction"
                    label="Ver obra / construcción"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <FormField
                control={form.control as any}
                name="can_view_sales"
                render={({ field }) => (
                  <CheckboxField
                    id="owner-can-view-sales"
                    label="Ver ventas"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

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
