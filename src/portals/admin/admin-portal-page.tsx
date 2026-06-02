/**
 * AdminPortalPage — minimal landing for admin and agent roles.
 * Full portal content is implemented in later slices.
 */
export function AdminPortalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="text-center">
        <h1 className="text-3xl text-navy">Portal Admin</h1>
        <p className="mt-2 text-slate2">Panel de administración</p>
      </div>
    </div>
  );
}
