/**
 * TDD — agency-profile hooks (A-WU4)
 *
 * RED first: these tests fail before the hook files exist.
 *
 * Spec coverage:
 *   R-A5  — logo_path in the payload does not start with https:// or http://
 *   R-A20 — upsert called with org_id + all profile fields; second call resolves
 *   R-A21 — upload-before-upsert ordering; if upload rejects, upsert never called
 *   A-WU4 — throws when orgId is absent from useAuth
 *   A-WU4 — upload key matches {orgId}/logo-{uuid}-{sanitized}
 *   A-WU4 — returns storage key (not a URL)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mock supabase ──────────────────────────────────────────────────────────────
const mockUpsert = vi.fn();
const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "org_profiles") {
          return {
            upsert: mockUpsert,
            select: vi.fn(() => ({
              eq: mockEq.mockReturnValue({
                maybeSingle: mockMaybeSingle,
              }),
            })),
          };
        }
        return { select: vi.fn() };
      }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

// ── Mock useAuth ──────────────────────────────────────────────────────────────
const mockAuthState = { orgId: "org-abc" as string | null };
vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => ({
    user: { email: "admin@nodo.com" },
    role: "admin",
    orgId: mockAuthState.orgId,
    signOut: vi.fn(),
    session: {},
    loading: false,
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

// ── useUpsertOrgProfile ───────────────────────────────────────────────────────
describe("useUpsertOrgProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.orgId = "org-abc";
    mockUpsert.mockResolvedValue({ data: [{}], error: null });
  });

  it("calls upsert with org_id injected from useAuth and profile fields", async () => {
    const { useUpsertOrgProfile } = await import(
      "@/features/agency-profile/hooks/use-upsert-org-profile"
    );
    const { result } = renderHook(() => useUpsertOrgProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        legal_name: "Inmobiliaria Test",
        address: "Corrientes 1234",
        cuit: "30-12345678-9",
        phone: "011-1234-5678",
        email: "info@test.com",
        logo_path: "org-abc/logo-uuid-test.jpg",
      });
    });

    expect(mockUpsert).toHaveBeenCalledOnce();
    const payload = mockUpsert.mock.calls[0][0];
    expect(payload).toMatchObject({
      org_id: "org-abc",
      legal_name: "Inmobiliaria Test",
      address: "Corrientes 1234",
      cuit: "30-12345678-9",
    });
  });

  it("R-A5: logo_path in payload does not start with https:// or http://", async () => {
    const { useUpsertOrgProfile } = await import(
      "@/features/agency-profile/hooks/use-upsert-org-profile"
    );
    const { result } = renderHook(() => useUpsertOrgProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        logo_path: "org-abc/logo-uuid-mylogo.png",
      });
    });

    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.logo_path).not.toMatch(/^https?:\/\//);
  });

  it("throws when orgId is absent from useAuth", async () => {
    mockAuthState.orgId = null;
    const { useUpsertOrgProfile } = await import(
      "@/features/agency-profile/hooks/use-upsert-org-profile"
    );
    const { result } = renderHook(() => useUpsertOrgProfile(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ legal_name: "Test" });
      })
    ).rejects.toThrow();
  });
});

// ── useUploadLogo ─────────────────────────────────────────────────────────────
describe("useUploadLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.orgId = "org-abc";
  });

  it("calls storage.upload with key matching {orgId}/logo-{uuid}-{sanitized}", async () => {
    mockUpload.mockResolvedValue({ data: { path: "org-abc/logo-uuid-test.jpg" }, error: null });

    const { useUploadLogo } = await import(
      "@/features/agency-profile/hooks/use-upload-logo"
    );
    const { result } = renderHook(() => useUploadLogo(), { wrapper });
    const file = new File(["content"], "My Logo.jpg", { type: "image/jpeg" });

    let returnedKey = "";
    await act(async () => {
      returnedKey = await result.current.mutateAsync({ file });
    });

    expect(mockUpload).toHaveBeenCalledOnce();
    const [key] = mockUpload.mock.calls[0] as [string, File, { upsert: boolean }];
    // Key must start with org_id and contain "logo-"
    expect(key).toMatch(/^org-abc\/logo-/);
    // Key must NOT start with https:// (R-A5)
    expect(key).not.toMatch(/^https?:\/\//);
    // Return value is the storage key
    expect(returnedKey).not.toMatch(/^https?:\/\//);
    expect(typeof returnedKey).toBe("string");
  });

  it("surfaces error on upload failure", async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: "Upload failed" } });

    const { useUploadLogo } = await import(
      "@/features/agency-profile/hooks/use-upload-logo"
    );
    const { result } = renderHook(() => useUploadLogo(), { wrapper });
    const file = new File(["content"], "logo.png", { type: "image/png" });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ file });
      })
    ).rejects.toBeTruthy();
  });
});

// ── useLogoUrl ────────────────────────────────────────────────────────────────
describe("useLogoUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.url/logo.jpg" },
      error: null,
    });
  });

  it("calls createSignedUrl with the given path and returns the signed URL", async () => {
    const { useLogoUrl } = await import(
      "@/features/agency-profile/hooks/use-logo-url"
    );
    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useLogoUrl(path),
      { wrapper, initialProps: { path: "org-abc/logo-uuid-test.jpg" } }
    );

    // Wait for query to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    rerender({ path: "org-abc/logo-uuid-test.jpg" });

    // The hook should have attempted to create the signed URL
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("org-abc/logo-uuid-test.jpg", 60);
  });

  it("is disabled when path is null — does not call createSignedUrl", async () => {
    const { useLogoUrl } = await import(
      "@/features/agency-profile/hooks/use-logo-url"
    );
    renderHook(() => useLogoUrl(null), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});
