/* eslint-disable @typescript-eslint/no-explicit-any */
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
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import { useContacts } from "@/features/contacts/hooks/use-contacts";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  address: z.string().min(1, "Dirección requerida"),
  operation: z.enum(["rent", "sale"], {
    error: "Seleccioná una operación",
  }),
  property_type: z.enum(["apartment", "house", "commercial", "land", "other"], {
    error: "Seleccioná un tipo",
  }),
  status: z.enum(["available", "reserved", "rented", "sold", "inactive"]),
  currency: z.enum(["ARS", "USD"]),
  // String fields for number inputs — coerced in onSubmit
  sale_price: z.string().optional(),
  total_sqm: z.string().optional(),
  rooms: z.string().optional(),
  description: z.string().optional(),
  inventory_description: z.string().optional(),
  // Owner FK — empty string means "no owner" (null)
  owner_id: z.string().optional(),
});

export type PropertyFormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNumberOrNull(v: string | undefined | null): number | null {
  if (!v || String(v).trim() === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toStringOrEmpty(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PropertyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog is in edit mode and prefills the form */
  property?: PropertyRow;
  /** Called after a successful submit */
  onSuccess?: () => void;
  /** Called when the form values should be persisted; receives the coerced payload */
  onSubmit: (
    values: ReturnType<typeof buildPayload>,
    property?: PropertyRow,
  ) => Promise<void>;
  isPending?: boolean;
}

function buildPayload(values: PropertyFormValues) {
  return {
    address: values.address,
    operation: values.operation,
    property_type: values.property_type,
    status: values.status,
    currency: values.currency,
    sale_price: toNumberOrNull(values.sale_price),
    total_sqm: toNumberOrNull(values.total_sqm),
    rooms: toNumberOrNull(values.rooms),
    description: values.description || null,
    inventory_description: values.inventory_description || null,
    owner_id: values.owner_id || null,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
  onSuccess,
  onSubmit,
  isPending = false,
}: PropertyFormDialogProps) {
  const isEdit = !!property;
  const { data: owners = [] } = useContacts("owner");

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      address: property?.address ?? "",
      operation: (property?.operation as any) ?? undefined,
      property_type: (property?.property_type as any) ?? undefined,
      status: (property?.status as any) ?? "available",
      currency: (property?.currency as any) ?? "ARS",
      sale_price: toStringOrEmpty(property?.sale_price),
      total_sqm: toStringOrEmpty(property?.total_sqm),
      rooms: toStringOrEmpty(property?.rooms),
      description: property?.description ?? "",
      inventory_description: property?.inventory_description ?? "",
      owner_id: property?.owner_id ?? "",
    },
  });

  async function handleSubmit(values: PropertyFormValues) {
    await onSubmit(buildPayload(values), property);
    if (!isEdit) form.reset();
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar propiedad" : "Nueva propiedad"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los campos y guardá los cambios."
              : "Completá los campos para cargar una nueva propiedad."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            {/* Address */}
            <FormField
              control={form.control as any}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="address-input">Dirección</FormLabel>
                  <FormControl>
                    <Input
                      id="address-input"
                      aria-label="Dirección"
                      placeholder="Av. Corrientes 1234"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Operation + Property type */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="operation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="operation-trigger">Operación</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          id="operation-trigger"
                          aria-label="Operación"
                        >
                          <SelectValue placeholder="Seleccioná" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="rent">Alquiler</SelectItem>
                        <SelectItem value="sale">Venta</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="property_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="type-trigger">
                      Tipo de propiedad
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          id="type-trigger"
                          aria-label="Tipo de propiedad"
                        >
                          <SelectValue placeholder="Seleccioná" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="apartment">Departamento</SelectItem>
                        <SelectItem value="house">Casa</SelectItem>
                        <SelectItem value="commercial">Local</SelectItem>
                        <SelectItem value="land">Terreno</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="status-trigger">Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          id="status-trigger"
                          aria-label="Estado"
                        >
                          <SelectValue placeholder="Disponible" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="reserved">Reservada</SelectItem>
                        <SelectItem value="rented">Alquilada</SelectItem>
                        <SelectItem value="sold">Vendida</SelectItem>
                        <SelectItem value="inactive">Inactiva</SelectItem>
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
                    <FormLabel htmlFor="currency-trigger">Moneda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          id="currency-trigger"
                          aria-label="Moneda"
                        >
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

            {/* Price + Sqm + Rooms */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control as any}
                name="sale_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="price-input">Precio</FormLabel>
                    <FormControl>
                      <Input
                        id="price-input"
                        aria-label="Precio"
                        type="number"
                        min={0}
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="total_sqm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="sqm-input">m²</FormLabel>
                    <FormControl>
                      <Input
                        id="sqm-input"
                        aria-label="m²"
                        type="number"
                        min={0}
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="rooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rooms-input">Ambientes</FormLabel>
                    <FormControl>
                      <Input
                        id="rooms-input"
                        aria-label="Ambientes"
                        type="number"
                        min={1}
                        placeholder="0"
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
                  <FormLabel htmlFor="description-input">Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      id="description-input"
                      aria-label="Descripción"
                      placeholder="Descripción de la propiedad…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Owner selector */}
            <FormField
              control={form.control as any}
              name="owner_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="owner-select">Propietario</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger
                        id="owner-select"
                        aria-label="Propietario"
                      >
                        <SelectValue placeholder="Sin propietario" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sin propietario</SelectItem>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
