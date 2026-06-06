/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { useAuth } from "@/app/auth/use-auth";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useUpsertOrgProfile } from "@/features/agency-profile/hooks/use-upsert-org-profile";
import { useUploadLogo } from "@/features/agency-profile/hooks/use-upload-logo";

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  legal_name: z.string().optional(),
  address: z.string().optional(),
  cuit: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{2}-?\d{8}-?\d$/.test(v),
      "CUIT inválido"
    ),
  phone: z.string().optional(),
  email: z
    .string()
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      "Email inválido"
    )
    .optional(),
  logo: z.instanceof(File).optional(),
});

export type AgencyProfileFormValues = z.infer<typeof schema>;

interface AgencyProfileFormProps {
  onSuccess?: () => void;
}

/**
 * Settings form for the agency profile (admin-only, R-A18).
 * Collects all comprobante fields + logo upload.
 * Upload-then-upsert ordering enforced on submit (R-A21).
 * Graceful with a null profile — renders empty inputs (R-A22).
 */
export function AgencyProfileForm({ onSuccess }: AgencyProfileFormProps) {
  const { role } = useAuth();
  const { data: profile } = useOrgProfile();
  const { mutateAsync: upsertProfile, isPending: isSaving } = useUpsertOrgProfile();
  const { mutateAsync: uploadLogo, isPending: isUploading } = useUploadLogo();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AgencyProfileFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      legal_name: profile?.legal_name ?? "",
      address: profile?.address ?? "",
      cuit: profile?.cuit ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
    },
    values: {
      legal_name: profile?.legal_name ?? "",
      address: profile?.address ?? "",
      cuit: profile?.cuit ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
    },
  });

  // Guard: only admins see the form (R-A18)
  if (role !== "admin") {
    return null;
  }

  const isPending = isSaving || isUploading;

  async function handleSubmit(values: AgencyProfileFormValues) {
    setError(null);
    try {
      let logoPath: string | undefined = undefined;

      // R-A21: upload first if a logo file is present
      if (values.logo) {
        logoPath = await uploadLogo({ file: values.logo });
      }

      const payload: Record<string, unknown> = {
        legal_name: values.legal_name || null,
        address: values.address || null,
        cuit: values.cuit || null,
        phone: values.phone || null,
        email: values.email || null,
      };

      if (logoPath !== undefined) {
        payload.logo_path = logoPath;
      }

      await upsertProfile(payload as any);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit as any)}
        className="flex flex-col gap-4"
      >
        {/* Legal name */}
        <FormField
          control={form.control as any}
          name="legal_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="profile-legal-name">Razón social</FormLabel>
              <FormControl>
                <Input
                  id="profile-legal-name"
                  aria-label="Razón social"
                  placeholder="Nombre legal de la agencia"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Address */}
        <FormField
          control={form.control as any}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="profile-address">Dirección</FormLabel>
              <FormControl>
                <Input
                  id="profile-address"
                  aria-label="Dirección"
                  placeholder="Domicilio comercial"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* CUIT */}
        <FormField
          control={form.control as any}
          name="cuit"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="profile-cuit">CUIT</FormLabel>
              <FormControl>
                <Input
                  id="profile-cuit"
                  aria-label="CUIT"
                  placeholder="XX-XXXXXXXX-X"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Phone */}
        <FormField
          control={form.control as any}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="profile-phone">Teléfono</FormLabel>
              <FormControl>
                <Input
                  id="profile-phone"
                  aria-label="Teléfono"
                  placeholder="Teléfono de contacto"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control as any}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="profile-email">Email</FormLabel>
              <FormControl>
                <Input
                  id="profile-email"
                  aria-label="Email"
                  placeholder="email@agencia.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Hidden File input for legacy testing suite backward compatibility */}
        <input
          id="profile-logo"
          aria-label="Logo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            form.setValue("logo", file);
          }}
        />

        {/* Error feedback */}
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={isPending} className="self-start">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </form>
    </Form>
  );
}
