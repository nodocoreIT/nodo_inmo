/**
 * TDD — ProfileDialog
 * Tests: renders name + password fields, updates full_name on submit,
 * includes password when provided, blocks on mismatch.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUpdateUser = vi.fn();
vi.mock("@/shared/lib/supabase", () => ({
  supabase: { auth: { updateUser: (...a: unknown[]) => mockUpdateUser(...a) } },
}));

import { ProfileDialog } from "@/features/profile/components/profile-dialog";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDialog(props: Partial<React.ComponentProps<typeof ProfileDialog>> = {}) {
  return render(
    <ProfileDialog
      open
      onOpenChange={vi.fn()}
      currentName="Ramiro"
      email="admin@nodo.com"
      {...props}
    />,
    { wrapper },
  );
}

describe("ProfileDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("renders name and password fields, prefilled name and read-only email", () => {
    renderDialog();
    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue("Ramiro");
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin@nodo.com")).toBeDisabled();
  });

  it("updates full_name (no password) on submit", async () => {
    renderDialog();
    const name = screen.getByLabelText(/^nombre$/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Ramiro Toulemonde");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledOnce());
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { full_name: "Ramiro Toulemonde" },
    });
  });

  it("includes the password when provided and matching", async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText(/nueva contraseña/i), "secret1");
    await userEvent.type(screen.getByLabelText(/confirmar contraseña/i), "secret1");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledOnce());
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { full_name: "Ramiro" },
      password: "secret1",
    });
  });

  it("blocks submit when passwords do not match", async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText(/nueva contraseña/i), "secret1");
    await userEvent.type(screen.getByLabelText(/confirmar contraseña/i), "secret2");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
