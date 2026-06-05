/**
 * TDD — AgencyProfileForm (A-WU5)
 *
 * RED first: these tests fail before the component exists.
 *
 * Spec coverage:
 *   R-A18 — Renders for admin; absent/redirects for agent
 *   R-A19 — Form contains address, CUIT, phone, email, file inputs
 *   R-A20 — On valid submit, useUpsertOrgProfile.mutateAsync called with payload
 *   R-A21 — Submit with logo: upload called before upsert; if upload rejects, upsert never called
 *   R-A22 — When useOrgProfile returns null, renders empty/placeholder, no throw
 *   CUIT zod validation — invalid format shows error, blocks submit
 *   Email validation — invalid email shows error, blocks submit
 *   onSuccess callback — called after successful save
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock supabase ──────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({ from: vi.fn(() => ({ select: vi.fn() })) })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(), createSignedUrl: vi.fn() })) },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

// ── Mock useAuth ──────────────────────────────────────────────────────────────
const mockAuthState = { role: "admin" as "admin" | "agent" };
vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => ({
    user: { email: "admin@nodo.com" },
    role: mockAuthState.role,
    orgId: "org-abc",
    signOut: vi.fn(),
    session: {},
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock mutation + query hooks ──────────────────────────────────────────────
const mockUpsertAsync = vi.fn();
const mockUploadAsync = vi.fn();
const mockProfileData = { data: null as null | object };

vi.mock("@/features/agency-profile/hooks/use-upsert-org-profile", () => ({
  useUpsertOrgProfile: () => ({
    mutateAsync: mockUpsertAsync,
    isPending: false,
  }),
  ORG_PROFILE_QUERY_KEY: ["nodo_inmo", "org_profiles"],
}));

vi.mock("@/features/agency-profile/hooks/use-upload-logo", () => ({
  useUploadLogo: () => ({
    mutateAsync: mockUploadAsync,
    isPending: false,
  }),
}));

vi.mock("@/features/agency-profile/hooks/use-org-profile", () => ({
  useOrgProfile: () => ({
    data: mockProfileData.data,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/features/agency-profile/hooks/use-logo-url", () => ({
  useLogoUrl: () => ({
    data: null,
    isLoading: false,
  }),
}));

// ── Import component AFTER mocks ─────────────────────────────────────────────
import { AgencyProfileForm } from "@/features/agency-profile/components/agency-profile-form";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderForm(props: { onSuccess?: () => void } = {}) {
  return render(
    <AgencyProfileForm onSuccess={props.onSuccess} />,
    { wrapper }
  );
}

// ── R-A18: Role visibility ────────────────────────────────────────────────────
describe("AgencyProfileForm — R-A18 role visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
    mockProfileData.data = null;
  });

  it("renders the form when role = admin", () => {
    renderForm();
    // Form should be present — at minimum the save button
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("does NOT render the form when role = agent", () => {
    mockAuthState.role = "agent";
    renderForm();
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });
});

// ── R-A19: Field rendering ────────────────────────────────────────────────────
describe("AgencyProfileForm — R-A19 field rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
    mockProfileData.data = null;
  });

  it("renders address, CUIT, phone, email, and file inputs", () => {
    renderForm();

    expect(screen.getByLabelText(/direcci[oó]n|address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cuit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tel[eé]fono|phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });
});

// ── R-A20: Upsert on valid submit ─────────────────────────────────────────────
describe("AgencyProfileForm — R-A20 upsert on submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
    mockProfileData.data = null;
    mockUpsertAsync.mockResolvedValue({});
  });

  it("calls mutateAsync with correct payload on valid submit", async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText(/direcci[oó]n|address/i), "Corrientes 1234");
    await userEvent.type(screen.getByLabelText(/cuit/i), "30-12345678-9");
    await userEvent.type(screen.getByLabelText(/tel[eé]fono|phone/i), "011-4444-5555");
    await userEvent.type(screen.getByLabelText(/email/i), "info@agencia.com");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUpsertAsync).toHaveBeenCalledOnce(), { timeout: 3000 });

    const payload = mockUpsertAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      address: "Corrientes 1234",
      cuit: "30-12345678-9",
      phone: "011-4444-5555",
      email: "info@agencia.com",
    });
  });

  it("calls onSuccess callback after successful save", async () => {
    mockUpsertAsync.mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<AgencyProfileForm onSuccess={onSuccess} />, { wrapper });

    await userEvent.type(screen.getByLabelText(/direcci[oó]n|address/i), "San Martín 100");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce(), { timeout: 3000 });
  });
});

// ── R-A21: Upload ordering ────────────────────────────────────────────────────
describe("AgencyProfileForm — R-A21 upload ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
    mockProfileData.data = null;
    mockUpsertAsync.mockResolvedValue({});
  });

  it("calls uploadLogo before upsert when a file is selected", async () => {
    const callOrder: string[] = [];
    mockUploadAsync.mockImplementation(async () => {
      callOrder.push("upload");
      return "org-abc/logo-uuid-test.jpg";
    });
    mockUpsertAsync.mockImplementation(async () => {
      callOrder.push("upsert");
      return {};
    });

    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "logo.jpg", { type: "image/jpeg" });
    await userEvent.upload(fileInput, file);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUpsertAsync).toHaveBeenCalledOnce(), { timeout: 3000 });

    expect(callOrder).toEqual(["upload", "upsert"]);
  });

  it("if upload rejects, upsert is never called", async () => {
    mockUploadAsync.mockRejectedValue(new Error("Upload failed"));

    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "logo.jpg", { type: "image/jpeg" });
    await userEvent.upload(fileInput, file);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUploadAsync).toHaveBeenCalled(), { timeout: 3000 });
    expect(mockUpsertAsync).not.toHaveBeenCalled();
  });
});

// ── R-A22: Missing profile — graceful empty ────────────────────────────────────
describe("AgencyProfileForm — R-A22 missing profile graceful", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
    mockProfileData.data = null;
  });

  it("renders without throwing when useOrgProfile returns null", () => {
    expect(() => renderForm()).not.toThrow();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });
});

// ── Zod validation ────────────────────────────────────────────────────────────
describe("AgencyProfileForm — zod validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
    mockProfileData.data = null;
  });

  it("shows CUIT validation error for invalid format and blocks submit", async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText(/cuit/i), "INVALID");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/cuit inv[aá]lido|invalid/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(mockUpsertAsync).not.toHaveBeenCalled();
  });

  it("shows email validation error for invalid email and blocks submit", async () => {
    renderForm();

    // type="email" inputs in jsdom don't block input, but the zod refine fires.
    // We target the email field by id to avoid type=email native validation interference.
    const emailInput = document.getElementById("profile-email") as HTMLInputElement;
    await userEvent.type(emailInput, "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      // The error message from zod refine OR from native form validation
      const emailErrors = screen.queryAllByText(/email inv[aá]lido|invalid email/i);
      expect(emailErrors.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    expect(mockUpsertAsync).not.toHaveBeenCalled();
  });
});
