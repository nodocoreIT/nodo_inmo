/**
 * AuthProvider + useAuth hook
 *
 * Wraps the app, subscribes to supabase.auth.onAuthStateChange,
 * and loads the initial session via supabase.auth.getSession().
 *
 * Role and orgId are read from session.user.app_metadata — NEVER
 * from user_metadata, which is user-editable and unsafe for authorization.
 *
 * Security note: Role-based routing in this app is a UX convenience only.
 * The actual security boundary is Postgres Row-Level Security (RLS) enforced
 * server-side. The frontend cannot be trusted as a security layer.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppRole = "admin" | "agent" | "owner" | "tenant";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** Read from app_metadata — null when claim-sync hasn't run yet */
  role: AppRole | null;
  /** Read from app_metadata — null when claim-sync hasn't run yet */
  orgId: string | null;
  loading: boolean;
  signInWithPassword: (credentials: {
    email: string;
    password: string;
  }) => ReturnType<typeof supabase.auth.signInWithPassword>;
  signOut: () => ReturnType<typeof supabase.auth.signOut>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial session; sets loading=false regardless of outcome.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(
    (credentials: { email: string; password: string }) =>
      supabase.auth.signInWithPassword(credentials),
    [],
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const user = session?.user ?? null;
  const role = (user?.app_metadata?.role as AppRole) ?? null;
  const orgId = (user?.app_metadata?.org_id as string) ?? null;

  return (
    <AuthContext.Provider
      value={{ session, user, role, orgId, loading, signInWithPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
