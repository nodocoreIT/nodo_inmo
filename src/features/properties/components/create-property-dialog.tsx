import { useCreateProperty } from "@/features/properties/hooks/use-create-property";
import { PropertyFormDialog } from "./property-form-dialog";

interface CreatePropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePropertyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePropertyDialogProps) {
  const { mutateAsync, isPending } = useCreateProperty();

  return (
    <PropertyFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      onSubmit={(payload) => mutateAsync(payload).then(() => undefined)}
      isPending={isPending}
    />
  );
}
