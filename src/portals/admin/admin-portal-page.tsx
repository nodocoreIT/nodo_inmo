import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/admin-layout";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";
import { PropertiesList } from "@/features/properties/components/properties-list";
import { PropietariosList } from "@/features/contacts/components/propietarios-list";
import { InquilinosList } from "@/features/contacts/components/inquilinos-list";
import { ContractsList } from "@/features/contracts/components/contracts-list";
import { PaymentsList } from "@/features/payments/components/payments-list";
import { CajaPage } from "@/features/caja/components/caja-page";
import { DocumentosPage } from "@/features/documentos/components/documentos-page";
import { PortalPage } from "@/features/portal/components/portal-page";
import { AgendaPage } from "@/features/agenda/components/agenda-page";

export function AdminPortalPage() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        {/* Default → dashboard */}
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="properties" element={<PropertiesList />} />
        <Route path="owners" element={<PropietariosList />} />
        <Route path="tenants" element={<InquilinosList />} />
        <Route path="contracts" element={<ContractsList />} />
        <Route path="payments" element={<PaymentsList />} />
        <Route path="caja" element={<CajaPage />} />
        <Route path="documentos" element={<DocumentosPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="portal" element={<PortalPage />} />
      </Route>
    </Routes>
  );
}
