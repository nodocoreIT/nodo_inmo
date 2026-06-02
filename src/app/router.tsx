import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RoleRouter } from "@/app/auth/role-router";
import { RequireAuth } from "@/shared/components/require-auth/require-auth";
import { LoginPage } from "@/features/auth/login/login-page";
import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { OwnerPortalPage } from "@/portals/owner/owner-portal-page";
import { TenantPortalPage } from "@/portals/tenant/tenant-portal-page";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate2">404 — page not found</p>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Role dispatch: "/" → admin/owner/tenant portal based on app_metadata.role */}
        <Route path="/" element={<RoleRouter />} />

        {/* Protected portal routes */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <AdminPortalPage />
            </RequireAuth>
          }
        />
        <Route
          path="/owner/*"
          element={
            <RequireAuth>
              <OwnerPortalPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tenant/*"
          element={
            <RequireAuth>
              <TenantPortalPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
