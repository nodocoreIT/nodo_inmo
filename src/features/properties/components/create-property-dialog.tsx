import { useCreateProperty } from "@/features/properties/hooks/use-create-property";
import { PropertyFormDialog } from "./property-form-dialog";
import type { PropertyFormValues } from "./property-form-dialog";

interface CreatePropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultValues?: Partial<PropertyFormValues>;
}

export function CreatePropertyDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultValues,
}: CreatePropertyDialogProps) {
  const { mutateAsync, isPending } = useCreateProperty();

  return (
    <PropertyFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      onSubmit={(payload) => mutateAsync(payload).then(() => undefined)}
      isPending={isPending}
      defaultValues={defaultValues}
    />
  );
}
