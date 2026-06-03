/**
 * TDD — useContacts hook: role filtering
 * Tests:
 *   - calls .select('*') with no filter when no role given
 *   - calls .contains('roles', ['owner']) when role='owner'
 *   - calls .contains('roles', ['tenant']) when role='tenant'
 *   - calls .contains('roles', ['guarantor']) when role='guarantor'
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mock chain builders ───────────────────────────────────────────────────────
const mockContains = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockSchema = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: (...args: unknown[]) => mockSchema(...args),
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => ({
    user: { email: "admin@nodo.com" },
    role: "admin",
    orgId: "org-1",
    signOut: vi.fn(),
    session: {},
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useContacts } from "@/features/contacts/hooks/use-contacts";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useContacts — role filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Base chain: schema().from().select().order() — no role
    // Extended chain: schema().from().select().contains().order() — with role
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockContains.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ order: mockOrder, contains: mockContains });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSchema.mockReturnValue({ from: mockFrom });
  });

  it("queries contacts without contains when no role given", async () => {
    const { result } = renderHook(() => useContacts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSchema).toHaveBeenCalledWith("nodo_inmo");
    expect(mockFrom).toHaveBeenCalledWith("contacts");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockContains).not.toHaveBeenCalled();
  });

  it("calls .contains('roles', ['owner']) when role='owner'", async () => {
    const { result } = renderHook(() => useContacts("owner"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockContains).toHaveBeenCalledWith("roles", ["owner"]);
  });

  it("calls .contains('roles', ['tenant']) when role='tenant'", async () => {
    const { result } = renderHook(() => useContacts("tenant"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockContains).toHaveBeenCalledWith("roles", ["tenant"]);
  });

  it("calls .contains('roles', ['guarantor']) when role='guarantor'", async () => {
    const { result } = renderHook(() => useContacts("guarantor"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockContains).toHaveBeenCalledWith("roles", ["guarantor"]);
  });

  it("returns data from successful query", async () => {
    const fixture = [
      {
        id: "c-1",
        name: "Ana López",
        roles: ["owner"],
        org_id: "org-1",
        dni: null,
        phone: null,
        email: null,
        address: null,
        commission_rate: 10,
        can_view_rentals: false,
        can_view_construction: false,
        can_view_sales: false,
        portal_user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    mockOrder.mockResolvedValue({ data: fixture, error: null });

    const { result } = renderHook(() => useContacts("owner"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fixture);
  });
});
