import { BrowserRouter, Route, Routes } from "react-router-dom";

// Placeholder pages — replaced by portal slices
function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="text-center">
        <h1 className="text-4xl text-navy">Nodo Inmo</h1>
        <p className="mt-4 text-slate2">
          Scaffold ready. Portal slices go here.
        </p>
      </div>
    </div>
  );
}

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
        <Route path="/" element={<HomePage />} />
        {/* Portal routes — added in auth/portal slices */}
        {/* <Route path="/admin/*" element={<AdminPortal />} /> */}
        {/* <Route path="/owner/*" element={<OwnerPortal />} /> */}
        {/* <Route path="/tenant/*" element={<TenantPortal />} /> */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
