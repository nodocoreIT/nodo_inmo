import { useCreateOwner } from "@/features/owners/hooks/use-create-owner";
import { OwnerFormDialog } from "./owner-form-dialog";

interface CreateOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateOwnerDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOwnerDialogProps) {
  const { mutateAsync, isPending } = useCreateOwner();

  return (
    <OwnerFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      onSubmit={(payload) => mutateAsync(payload).then(() => undefined)}
      isPending={isPending}
    />
  );
}
