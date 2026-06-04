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
import { Label } from "@/shared/components/ui/label";
import { useUpdateProfile } from "@/features/profile/hooks/use-update-profile";

const schema = z
  .object({
    full_name: z.string().min(1, "El nombre es requerido"),
    password: z.string().optional(),
    confirm_password: z.string().optional(),
  })
  .refine(
    (v) => !v.password || v.password.length >= 6,
    { path: ["password"], message: "Mínimo 6 caracteres" },
  )
  .refine((v) => (v.password ?? "") === (v.confirm_password ?? ""), {
    path: ["confirm_password"],
    message: "Las contraseñas no coinciden",
  });

export type ProfileFormValues = z.infer<typeof schema>;

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current display name (user_metadata.full_name). */
  currentName?: string;
  /** Current email — shown read-only. */
  email?: string;
  onSuccess?: () => void;
}

export function ProfileDialog({
  open,
  onOpenChange,
  currentName = "",
  email = "",
  onSuccess,
}: ProfileDialogProps) {
  const { mutateAsync, isPending } = useUpdateProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { full_name: currentName, password: "", confirm_password: "" },
  });

  async function handleSubmit(values: ProfileFormValues) {
    await mutateAsync({ full_name: values.full_name, password: values.password });
    form.reset({ full_name: values.full_name, password: "", confirm_password: "" });
    onSuccess?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mi perfil</DialogTitle>
          <DialogDescription>
            Actualizá tu nombre y, si querés, tu contraseña.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            {/* Email (read-only) */}
            <div className="space-y-1">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={email} disabled readOnly />
            </div>

            {/* Full name */}
            <FormField
              control={form.control as any}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="profile-name">Nombre</FormLabel>
                  <FormControl>
                    <Input
                      id="profile-name"
                      aria-label="Nombre"
                      placeholder="Tu nombre"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New password */}
            <FormField
              control={form.control as any}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="profile-password">Nueva contraseña</FormLabel>
                  <FormControl>
                    <Input
                      id="profile-password"
                      aria-label="Nueva contraseña"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Dejá en blanco para no cambiarla"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirm password */}
            <FormField
              control={form.control as any}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="profile-confirm">Confirmar contraseña</FormLabel>
                  <FormControl>
                    <Input
                      id="profile-confirm"
                      aria-label="Confirmar contraseña"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repetí la nueva contraseña"
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
