/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
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
import { useUploadDocument } from "@/features/documentos/hooks/use-upload-document";
import { useProperties } from "@/features/properties/hooks/use-properties";
import { useContracts } from "@/features/contracts/hooks/use-contracts";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  label: z.string().min(1, "Etiqueta requerida"),
  document_type: z.enum(["factura", "presupuesto", "certificado", "otro"] as const, {
    message: "Tipo requerido",
  }),
  property_id: z.string().optional(),
  contract_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UploadDocumentDialog({ open, onOpenChange }: UploadDocumentDialogProps) {
  const { mutateAsync: uploadDocument, isPending } = useUploadDocument();
  const { data: properties } = useProperties();
  const { data: contracts } = useContracts();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      label: "",
      document_type: "otro" as any,
      property_id: undefined,
      contract_id: undefined,
      notes: "",
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileSizeError(null);

    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setFileSizeError("El archivo supera el límite de 10 MB.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  }

  async function handleSubmit(values: FormValues) {
    if (!selectedFile) return;
    setErrorMessage(null);

    try {
      await uploadDocument({
        file: selectedFile,
        label: values.label,
        document_type: values.document_type,
        property_id: values.property_id || undefined,
        contract_id: values.contract_id || undefined,
        notes: values.notes || undefined,
      });

      // Success — reset and close
      form.reset();
      setSelectedFile(null);
      setFileSizeError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error al subir el documento. Intentá de nuevo.",
      );
    }
  }

  const isSubmitDisabled =
    isPending || !selectedFile || !!fileSizeError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
          <DialogDescription>
            Cargá un documento y asocialo a una propiedad o contrato (opcional).
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
            {/* Label */}
            <FormField
              control={form.control as any}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="doc-label-input">Etiqueta</FormLabel>
                  <FormControl>
                    <Input
                      id="doc-label-input"
                      aria-label="Etiqueta del documento"
                      placeholder="Ej: Factura electricidad enero"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Document type */}
            <FormField
              control={form.control as any}
              name="document_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="doc-type-trigger">Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger id="doc-type-trigger" aria-label="Tipo de documento">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="factura">Factura</SelectItem>
                      <SelectItem value="presupuesto">Presupuesto</SelectItem>
                      <SelectItem value="certificado">Certificado</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Property (optional) */}
            <FormField
              control={form.control as any}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="doc-property-trigger">Propiedad (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                    value={field.value ?? "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger id="doc-property-trigger" aria-label="Propiedad">
                        <SelectValue placeholder="Ninguna" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Ninguna</SelectItem>
                      {(properties ?? []).map((p) => (
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

            {/* Contract (optional) */}
            <FormField
              control={form.control as any}
              name="contract_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="doc-contract-trigger">Contrato (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                    value={field.value ?? "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger id="doc-contract-trigger" aria-label="Contrato">
                        <SelectValue placeholder="Ninguno" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Ninguno</SelectItem>
                      {(contracts ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.tenant?.name ?? c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control as any}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="doc-notes-input">Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      id="doc-notes-input"
                      aria-label="Notas"
                      placeholder="Información adicional"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File upload */}
            <FormItem>
              <FormLabel htmlFor="doc-file-input">Archivo</FormLabel>
              <FormControl>
                <Input
                  id="doc-file-input"
                  aria-label="Archivo del documento"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </FormControl>
              {fileSizeError && (
                <p role="alert" className="text-sm text-destructive mt-1">
                  {fileSizeError}
                </p>
              )}
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
              <Button type="submit" disabled={isSubmitDisabled}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subir
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
