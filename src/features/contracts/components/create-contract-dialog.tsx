import { useCreateContract } from "@/features/contracts/hooks/use-create-contract";
import { ContractFormDialog } from "./contract-form-dialog";

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateContractDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateContractDialogProps) {
  const { mutateAsync, isPending } = useCreateContract();

  return (
    <ContractFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      onSubmit={(payload) => mutateAsync(payload).then(() => undefined)}
      isPending={isPending}
    />
  );
}
