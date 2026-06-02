/**
 * TDD — useAuth hook
 * Tests: session, role, orgId, loading transitions, signOut, signInWithPassword,
 *        onAuthStateChange reactivity, subscription cleanup.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";

// ── Mock the Supabase singleton BEFORE importing anything that uses it ────────
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { supabase } from "@/shared/lib/supabase";
import { AuthProvider, useAuth } from "@/app/auth/use-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast a partial mock object to the required return type without fighting TS */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asSubscriptionReturn(unsubscribeFn: ReturnType<typeof vi.fn>): ReturnType<typeof supabase.auth.onAuthStateChange> {
  return {
    data: {
      subscription: { unsubscribe: unsubscribeFn, id: "sub-1" } as unknown as ReturnType<
        typeof supabase.auth.onAuthStateChange
      >["data"]["subscription"],
    },
  };
}

/**
 * Build a fake JWT whose payload encodes app_metadata claims. useAuth reads
 * role/org_id from the decoded access_token (NOT from user.app_metadata, which
 * supabase-js fills from the stored user record without the hook-injected claims).
 */
function fakeJwt(appMetadata: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify({ app_metadata: appMetadata }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${b64}.sig`;
}

function makeUser(): User {
  return {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email: "test@nodo.com",
    app_metadata: {}, // mirrors reality: stored app_metadata has no role/org_id
    user_metadata: {},
    created_at: new Date().toISOString(),
  } as User;
}

function makeSession(
  appMetadata: Record<string, unknown> = { role: "admin", org_id: "org-abc" },
): Session {
  return {
    access_token: fakeJwt(appMetadata),
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: makeUser(),
  } as Session;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state then resolves session", async () => {
    const session = makeSession();

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
      asSubscriptionReturn(vi.fn()),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toEqual(session);
    expect(result.current.user).toEqual(session.user);
    expect(result.current.role).toBe("admin");
    expect(result.current.orgId).toBe("org-abc");
  });

  it("exposes null role and orgId when app_metadata is empty", async () => {
    // Token carries no app_metadata claims (claim-sync hasn't run).
    const session = makeSession({});

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
      asSubscriptionReturn(vi.fn()),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.role).toBeNull();
    expect(result.current.orgId).toBeNull();
  });

  it("resolves to null session when unauthenticated", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
      asSubscriptionReturn(vi.fn()),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it("signOut delegates to supabase.auth.signOut", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
      asSubscriptionReturn(vi.fn()),
    );
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });

  it("signInWithPassword delegates to supabase.auth.signInWithPassword", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
      asSubscriptionReturn(vi.fn()),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signInWithPassword({
        email: "test@nodo.com",
        password: "pass",
      });
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@nodo.com",
      password: "pass",
    });
  });

  it("reacts to onAuthStateChange events (sign-in after mount)", async () => {
    // Start unauthenticated
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let capturedCallback:
      | ((event: AuthChangeEvent, session: Session | null) => void)
      | null = null;

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
      capturedCallback = cb;
      return asSubscriptionReturn(vi.fn());
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();

    // Simulate sign-in event
    const newSession = makeSession();
    act(() => {
      capturedCallback!("SIGNED_IN", newSession);
    });

    expect(result.current.session).toEqual(newSession);
    expect(result.current.role).toBe("admin");
  });

  it("cleans up subscription on unmount", async () => {
    const unsubscribe = vi.fn();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
      asSubscriptionReturn(unsubscribe),
    );

    const { unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {});

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
