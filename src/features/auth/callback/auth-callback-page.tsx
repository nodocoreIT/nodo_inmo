/**
 * AuthCallbackPage — handles magic-link and OAuth redirects.
 *
 * Supabase JS v2 detects the session from the URL fragment automatically
 * when the client is initialised (detectSessionInUrl defaults to true).
 * We just need to wait for the auth state to settle and then redirect to "/".
 *
 * This route is typically configured as the "Redirect URL" in the Supabase
 * dashboard: https://<your-domain>/auth/callback
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // onAuthStateChange fires once the session from the URL fragment is exchanged.
    // We listen for a single SIGNED_IN event then navigate away.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        subscription.unsubscribe();
        navigate("/");
      }
    });

    // Fallback: if there's already a session (page re-visited), redirect
    // immediately rather than waiting for an event that may never fire.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe();
        navigate("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-slate2">Verificando sesión…</p>
    </div>
  );
}
