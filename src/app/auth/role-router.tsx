/**
 * RoleRouter — dispatches authenticated users to their portal.
 *
 * Security note: This routing is a UX convenience ONLY.
 * Authorization is enforced server-side via Postgres RLS.
 * A user who navigates directly to another portal URL will be
 * gated by RLS on every data request regardless of frontend routing.
 *
 * Role source: app_metadata (set by server-side claim-sync trigger).
 * Never use user_metadata for authorization decisions.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/auth/use-auth";

const ROLE_DESTINATIONS: Record<string, string> = {
  admin: "/admin",
  agent: "/admin",
  owner: "/owner",
  tenant: "/tenant",
};

export function RoleRouter() {
  const { loading, session, role } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (role && ROLE_DESTINATIONS[role]) {
    return <Navigate to={ROLE_DESTINATIONS[role]} replace />;
  }

  // Session exists but no role yet — redirect to pending state via RequireAuth
  // (or show inline; for now redirect to a protected route that shows it)
  return <Navigate to="/pending" replace />;
}
