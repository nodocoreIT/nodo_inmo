import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/admin-layout";
import { PropertiesList } from "@/features/properties/components/properties-list";
import { PropietariosList } from "@/features/contacts/components/propietarios-list";
import { InquilinosList } from "@/features/contacts/components/inquilinos-list";
import { ContractsList } from "@/features/contracts/components/contracts-list";
import { PaymentsList } from "@/features/payments/components/payments-list";
import { CajaPage } from "@/features/caja/components/caja-page";

export function AdminPortalPage() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        {/* Default → properties */}
        <Route index element={<Navigate to="properties" replace />} />
        <Route path="properties" element={<PropertiesList />} />
        <Route path="owners" element={<PropietariosList />} />
        <Route path="tenants" element={<InquilinosList />} />
        <Route path="contracts" element={<ContractsList />} />
        <Route path="payments" element={<PaymentsList />} />
        <Route path="caja" element={<CajaPage />} />
      </Route>
    </Routes>
  );
}
