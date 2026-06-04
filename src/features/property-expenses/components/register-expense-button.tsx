import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/app/auth/use-auth";
import { ExpenseFormDialog } from "./expense-form-dialog";

interface RegisterExpenseButtonProps {
  propertyId: string;
}

/**
 * Row action that opens the expense registration dialog.
 * Only rendered for admin users (UI mirror of the Template B RLS gate).
 */
export function RegisterExpenseButton({ propertyId }: RegisterExpenseButtonProps) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  if (role !== "admin") return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Registrar gasto"
        onClick={() => setOpen(true)}
      >
        <Receipt className="h-4 w-4" />
        <span className="ml-1 hidden sm:inline">Registrar gasto</span>
      </Button>

      <ExpenseFormDialog
        open={open}
        onOpenChange={setOpen}
        propertyId={propertyId}
        onSuccess={() => setOpen(false)}
      />
    </>
  );
}
