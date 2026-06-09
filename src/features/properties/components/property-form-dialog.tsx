import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Waves,
  PawPrint,
  Car,
  TreePine,
  WashingMachine,
  Flame,
  MoveVertical,
  ParkingCircle,
} from "lucide-react";
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
import { formatCurrencyInput, parseCurrencyInput } from "@/shared/lib/format-money";
import { PhotoGallery } from "./photo-gallery";
import { cn } from "@/shared/lib/utils";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  address: z.string().min(1, "Dirección requerida"),
  operation: z.enum(["rent", "sale"], { error: "Seleccioná una operación" }),
  property_type: z.enum(["apartment", "house", "commercial", "land", "other"], {
    error: "Seleccioná un tipo",
  }),
  status: z.enum(["available", "reserved", "rented", "sold", "inactive"]),
  currency: z.enum(["ARS", "USD"]),
  sale_price: z.string().optional(),
  total_sqm: z.string().optional(),
  rooms: z.string().optional(),
  bathrooms: z.string().optional(),
  description: z.string().optional(),
  inventory_description: z.string().optional(),
  owner_id: z.string().optional(),
  commission_rate: z.string().optional(),
  // Amenities
  has_pool: z.boolean().default(false),
  pets_allowed: z.boolean().default(false),
  has_garage: z.boolean().default(false),
  has_garden: z.boolean().default(false),
  has_laundry: z.boolean().default(false),
  has_bbq: z.boolean().default(false),
  has_elevator: z.boolean().default(false),
  has_parking: z.boolean().default(false),
});

export type PropertyFormValues = z.infer<typeof schema>;

const NO_OWNER = "none";

const AMENITY_TOGGLES = [
  { name: "has_pool" as const, label: "Pileta", icon: <Waves className="h-4 w-4" /> },
  { name: "pets_allowed" as const, label: "Mascotas", icon: <PawPrint className="h-4 w-4" /> },
  { name: "has_garage" as const, label: "Garaje", icon: <Car className="h-4 w-4" /> },
  { name: "has_garden" as const, label: "Jardín", icon: <TreePine className="h-4 w-4" /> },
  { name: "has_laundry" as const, label: "Lavadero", icon: <WashingMachine className="h-4 w-4" /> },
  { name: "has_bbq" as const, label: "Parrilla", icon: <Flame className="h-4 w-4" /> },
  { name: "has_elevator" as const, label: "Ascensor", icon: <MoveVertical className="h-4 w-4" /> },
  { name: "has_parking" as const, label: "Estacionamiento", icon: <ParkingCircle className="h-4 w-4" /> },
];

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
  /** Pre-filled values from voice extraction (create mode only) */
  defaultValues?: Partial<PropertyFormValues>;
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
    sale_price: parseCurrencyInput(values.sale_price),
    total_sqm: toNumberOrNull(values.total_sqm),
    rooms: toNumberOrNull(values.rooms),
    bathrooms: toNumberOrNull(values.bathrooms),
    description: values.description || null,
    inventory_description: values.inventory_description || null,
    owner_id: values.owner_id || null,
    commission_rate: toNumberOrNull(values.commission_rate),
    has_pool: values.has_pool,
    pets_allowed: values.pets_allowed,
    has_garage: values.has_garage,
    has_garden: values.has_garden,
    has_laundry: values.has_laundry,
    has_bbq: values.has_bbq,
    has_elevator: values.has_elevator,
    has_parking: values.has_parking,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
  defaultValues: voiceDefaults,
  onSuccess,
  onSubmit,
  isPending = false,
}: PropertyFormDialogProps) {
  const isEdit = !!property;
  const { data: owners = [] } = useContacts("owner");

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      address: property?.address ?? voiceDefaults?.address ?? "",
      operation: (property?.operation as any) ?? voiceDefaults?.operation ?? undefined,
      property_type: (property?.property_type as any) ?? voiceDefaults?.property_type ?? undefined,
      status: (property?.status as any) ?? voiceDefaults?.status ?? "available",
      currency: (property?.currency as any) ?? voiceDefaults?.currency ?? "ARS",
      sale_price:
        formatCurrencyInput(property?.sale_price, (property?.currency as any) ?? "ARS") ||
        voiceDefaults?.sale_price ||
        "",
      total_sqm: toStringOrEmpty(property?.total_sqm) || voiceDefaults?.total_sqm || "",
      rooms: toStringOrEmpty(property?.rooms) || voiceDefaults?.rooms || "",
      bathrooms: toStringOrEmpty(property?.bathrooms),
      description: property?.description ?? voiceDefaults?.description ?? "",
      inventory_description: property?.inventory_description ?? "",
      owner_id: property?.owner_id ?? "",
      commission_rate: toStringOrEmpty(property?.commission_rate),
      has_pool: property?.has_pool ?? false,
      pets_allowed: property?.pets_allowed ?? false,
      has_garage: property?.has_garage ?? false,
      has_garden: property?.has_garden ?? false,
      has_laundry: property?.has_laundry ?? false,
      has_bbq: property?.has_bbq ?? false,
      has_elevator: property?.has_elevator ?? false,
      has_parking: property?.has_parking ?? false,
    },
  });


  const currency = form.watch("currency") || "ARS";
  const prevCurrencyRef = useRef(currency);
  useEffect(() => {
    if (prevCurrencyRef.current !== currency) {
      const currentPrice = form.getValues("sale_price");
      if (currentPrice) {
        const raw = currentPrice.replace(/\D/g, "");
        form.setValue("sale_price", formatCurrencyInput(raw, currency));
      }
      prevCurrencyRef.current = currency;
    }
  }, [currency, form]);

  async function handleSubmit(values: PropertyFormValues) {
    await onSubmit(buildPayload(values), property);
    if (!isEdit) form.reset();
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                        <SelectTrigger id="operation-trigger" aria-label="Operación">
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
                    <FormLabel htmlFor="type-trigger">Tipo de propiedad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger id="type-trigger" aria-label="Tipo de propiedad">
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
                        <SelectTrigger id="status-trigger" aria-label="Estado">
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

            {/* Price + Sqm + Rooms + Bathrooms */}
            <div className="grid grid-cols-4 gap-3">
              <FormField
                control={form.control as any}
                name="sale_price"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel htmlFor="price-input">Precio</FormLabel>
                    <FormControl>
                      <Input
                        id="price-input"
                        aria-label="Precio"
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
                name="rooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rooms-input">Amb.</FormLabel>
                    <FormControl>
                      <Input id="rooms-input" aria-label="Ambientes" type="number" min={1} placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="bathrooms-input">Baños</FormLabel>
                    <FormControl>
                      <Input id="bathrooms-input" aria-label="Baños" type="number" min={0} placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sqm */}
            <FormField
              control={form.control as any}
              name="total_sqm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="sqm-input">Superficie (m²)</FormLabel>
                  <FormControl>
                    <Input id="sqm-input" aria-label="m²" type="number" min={0} placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amenities */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Características</p>
              <div className="grid grid-cols-4 gap-2">
                {AMENITY_TOGGLES.map(({ name, label, icon }) => {
                  const active = form.watch(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => form.setValue(name, !active)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-md border p-2.5 text-[11px] font-medium transition-colors",
                        active
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border bg-card text-slate2 hover:bg-mist",
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>
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

            {/* Owner */}
            <FormField
              control={form.control as any}
              name="owner_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="owner-select">Propietario</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === NO_OWNER ? "" : v)}
                    value={field.value ? field.value : NO_OWNER}
                  >
                    <FormControl>
                      <SelectTrigger id="owner-select" aria-label="Propietario">
                        <SelectValue placeholder="Sin propietario" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_OWNER}>Sin propietario</SelectItem>
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

            {/* Commission Rate */}
            {form.watch("owner_id") && (
              <FormField
                control={form.control as any}
                name="commission_rate"
                render={({ field }) => {
                  const operation = form.watch("operation");
                  const label = operation === "sale"
                    ? "Honorarios por intermediación (%)"
                    : "Comisión por alquiler (%)";
                  return (
                    <FormItem>
                      <FormLabel htmlFor="commission-rate-input">{label}</FormLabel>
                      <FormControl>
                        <Input
                          id="commission-rate-input"
                          aria-label={label}
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            {/* Photo gallery */}
            {isEdit && property?.id && property?.org_id ? (
              <PhotoGallery
                paths={(property as any).photos ?? []}
                propertyId={property.id}
                orgId={property.org_id}
              />
            ) : (
              <p className="text-xs text-slate2">
                Podrás agregar fotos una vez creada la propiedad.
              </p>
            )}

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
