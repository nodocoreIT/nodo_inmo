import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/admin-layout";
import { PropertiesList } from "@/features/properties/components/properties-list";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-bold text-navy">{title}</h2>
      <p className="text-sm text-slate2">Próximamente disponible.</p>
    </div>
  );
}

export function AdminPortalPage() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        {/* Default → properties */}
        <Route index element={<Navigate to="properties" replace />} />
        <Route path="properties" element={<PropertiesList />} />
        <Route path="owners" element={<PlaceholderPage title="Propietarios" />} />
        <Route path="contracts" element={<PlaceholderPage title="Contratos" />} />
        <Route path="payments" element={<PlaceholderPage title="Pagos" />} />
        <Route path="caja" element={<PlaceholderPage title="Caja" />} />
      </Route>
    </Routes>
  );
}
