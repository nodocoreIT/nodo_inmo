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
import type {
  ContactRow,
  ContactRole,
} from "@/features/contacts/hooks/use-contacts";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  dni: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  // Owner-specific fields
  commission_rate: z.string().optional(),
  can_view_rentals: z.boolean(),
  can_view_construction: z.boolean(),
  can_view_sales: z.boolean(),
  // Role toggles (edit mode)
  role_owner: z.boolean(),
  role_tenant: z.boolean(),
  role_guarantor: z.boolean(),
});

export type ContactFormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNumberOrDefault(v: string | undefined | null, def: number): number {
  if (!v || String(v).trim() === "") return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function buildRoles(
  values: ContactFormValues,
  defaultRole?: ContactRole,
): string[] {
  const roles: string[] = [];
  if (values.role_owner) roles.push("owner");
  if (values.role_tenant) roles.push("tenant");
  if (values.role_guarantor) roles.push("guarantor");
  // If no checkboxes rendered (create mode), use defaultRole
  if (roles.length === 0 && defaultRole) return [defaultRole];
  return roles;
}

function buildPayload(values: ContactFormValues, defaultRole?: ContactRole) {
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
    roles: buildRoles(values, defaultRole),
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing contact — triggers edit mode with role toggles */
  contact?: ContactRow;
  /**
   * Used in create mode to set the initial role.
   * Owner-specific fields are shown when defaultRole='owner' or contact has owner role.
   */
  defaultRole?: ContactRole;
  onSuccess?: () => void;
  onSubmit: (
    values: ReturnType<typeof buildPayload>,
    contact?: ContactRow,
  ) => Promise<void>;
  isPending?: boolean;
}

// ── Checkbox component ────────────────────────────────────────────────────────

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

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  defaultRole,
  onSuccess,
  onSubmit,
  isPending = false,
}: ContactFormDialogProps) {
  const isEdit = !!contact;

  // Determine whether to show owner-specific fields:
  // - create mode: shown when defaultRole is 'owner'
  // - edit mode: shown when the contact currently has the 'owner' role
  const contactRoles = contact?.roles ?? [];
  const hasOwnerRole = isEdit
    ? contactRoles.includes("owner")
    : defaultRole === "owner";

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: contact?.name ?? "",
      dni: contact?.dni ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      address: contact?.address ?? "",
      commission_rate:
        contact?.commission_rate != null
          ? String(contact.commission_rate)
          : "10",
      can_view_rentals: contact?.can_view_rentals ?? false,
      can_view_construction: contact?.can_view_construction ?? false,
      can_view_sales: contact?.can_view_sales ?? false,
      // Role toggles — only meaningful in edit mode
      role_owner: contactRoles.includes("owner"),
      role_tenant: contactRoles.includes("tenant"),
      role_guarantor: contactRoles.includes("guarantor"),
    },
  });

  // In edit mode, dynamically show owner fields based on role_owner checkbox
  const watchRoleOwner = form.watch("role_owner");
  const showOwnerFields = isEdit ? watchRoleOwner : hasOwnerRole;

  async function handleSubmit(values: ContactFormValues) {
    await onSubmit(
      buildPayload(values, isEdit ? undefined : defaultRole),
      contact,
    );
    if (!isEdit) form.reset();
    onSuccess?.();
  }

  const title = isEdit
    ? "Editar contacto"
    : defaultRole === "tenant"
      ? "Nuevo inquilino"
      : "Nuevo propietario";
  const description = isEdit
    ? "Modificá los campos y guardá los cambios."
    : "Completá los campos para registrar el nuevo contacto.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
                  <FormLabel htmlFor="contact-name-input">Nombre</FormLabel>
                  <FormControl>
                    <Input
                      id="contact-name-input"
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
                    <FormLabel htmlFor="contact-dni-input">DNI</FormLabel>
                    <FormControl>
                      <Input
                        id="contact-dni-input"
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
                    <FormLabel htmlFor="contact-phone-input">
                      Teléfono
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="contact-phone-input"
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

            {/* Email + Commission (owner only) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="contact-email-input">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="contact-email-input"
                        aria-label="Email"
                        type="email"
                        placeholder="contacto@mail.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showOwnerFields && (
                <FormField
                  control={form.control as any}
                  name="commission_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Address */}
            <FormField
              control={form.control as any}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-address-input">
                    Dirección
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="contact-address-input"
                      aria-label="Dirección"
                      placeholder="Av. Corrientes 1234"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role toggles — edit mode only */}
            {isEdit && (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium text-slate2">Roles</p>
                <FormField
                  control={form.control as any}
                  name="role_owner"
                  render={({ field }) => (
                    <CheckboxField
                      id="contact-role-owner"
                      label="Propietario"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="role_tenant"
                  render={({ field }) => (
                    <CheckboxField
                      id="contact-role-tenant"
                      label="Inquilino"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="role_guarantor"
                  render={({ field }) => (
                    <CheckboxField
                      id="contact-role-guarantor"
                      label="Garante"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}

            {/* Owner portal permissions — shown when owner role is active */}
            {showOwnerFields && (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium text-slate2">
                  Acceso al portal del propietario
                </p>

                <FormField
                  control={form.control as any}
                  name="can_view_rentals"
                  render={({ field }) => (
                    <CheckboxField
                      id="contact-can-view-rentals"
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
                      id="contact-can-view-construction"
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
                      id="contact-can-view-sales"
                      label="Ver ventas"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
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
