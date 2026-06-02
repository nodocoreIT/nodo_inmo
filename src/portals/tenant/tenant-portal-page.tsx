/**
 * TenantPortalPage — minimal landing for tenants.
 * Full portal content is implemented in later slices.
 */
export function TenantPortalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="text-center">
        <h1 className="text-3xl text-navy">Portal Inquilino</h1>
        <p className="mt-2 text-slate2">Tu espacio de inquilino</p>
      </div>
    </div>
  );
}
