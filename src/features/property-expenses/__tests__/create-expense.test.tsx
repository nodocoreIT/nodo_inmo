/**
 * TDD — ExpenseFormDialog + RegisterExpenseButton (WU5)
 *
 * RED first: these tests fail before the components exist.
 *
 * Spec coverage:
 *   R21 — "Registrar gasto" visible for admin, hidden for agent
 *   R22 — form renders all required fields (type, amount, currency, date,
 *          description, charged_to_owner radio group, file input);
 *          neither Sí nor No radio is pre-selected (no default — ADR-4)
 *   R23 — missing/zero amount → validation error visible + no mutateAsync call
 *   R23 — valid submit → mutateAsync called with correct payload; receipt_path is a key not a URL
 *   R23 — charged_to_owner: false path — selecting "No" sends boolean false
 *   R24 — upload-then-insert ordering; if upload rejects, mutateAsync is never called
 *   R25 — success: dialog closes (onSuccess callback); failure: error visible + dialog stays open
 *
 * Mocking strategy:
 *   - Radix Select → native <select> (same pattern as create-property.test.tsx)
 *   - supabase, useAuth, useCreateExpense, useUploadReceipt are all mocked
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock supabase (needed by auth provider, not used directly in form tests) ──
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
// Use an object so tests can mutate the role field between test runs.
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

// ── Mock Radix Select with native <select> for jsdom testability ──────────────
vi.mock("@/shared/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    "aria-label"?: string;
    id?: string;
  }) => <>{children}</>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SelectValue: (_placeholder: { placeholder?: string }) => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    if (value === "") {
      throw new Error("A <SelectItem /> must have a value prop that is not an empty string.");
    }
    return <option value={value}>{children}</option>;
  },
}));

// ── Mock mutation hooks ───────────────────────────────────────────────────────
const mockMutateAsync = vi.fn();
const mockUploadMutateAsync = vi.fn();

vi.mock("@/features/property-expenses/hooks/use-create-expense", () => ({
  useCreateExpense: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  PROPERTY_EXPENSES_QUERY_KEY: ["nodo_inmo", "property_expenses"],
}));

vi.mock("@/features/property-expenses/hooks/use-upload-receipt", () => ({
  useUploadReceipt: () => ({
    mutateAsync: mockUploadMutateAsync,
    isPending: false,
  }),
}));

// ── Import components AFTER mocks ─────────────────────────────────────────────
import { ExpenseFormDialog } from "@/features/property-expenses/components/expense-form-dialog";
import { RegisterExpenseButton } from "@/features/property-expenses/components/register-expense-button";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDialog(props: {
  open?: boolean;
  onSuccess?: () => void;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  return render(
    <ExpenseFormDialog
      open={props.open ?? true}
      onOpenChange={props.onOpenChange ?? vi.fn()}
      propertyId="prop-1"
      onSuccess={props.onSuccess}
    />,
    { wrapper },
  );
}

/**
 * Fill all required fields with valid values.
 * date input: use clear() + type() to avoid appending to the default date value.
 * charged_to_owner: click the "Sí" radio button (charged_to_owner = true).
 */
async function fillValidForm() {
  const selects = screen.getAllByRole("combobox");
  await userEvent.selectOptions(selects[0], "arreglo");         // type
  await userEvent.clear(screen.getByLabelText(/monto/i));
  await userEvent.type(screen.getByLabelText(/monto/i), "3500");
  await userEvent.selectOptions(selects[1], "ARS");             // currency
  // Date input — clear existing value then type new value
  const dateInput = screen.getByLabelText(/fecha/i);
  await userEvent.clear(dateInput);
  await userEvent.type(dateInput, "2026-06-04");
  await userEvent.type(screen.getByLabelText(/descripci[oó]n/i), "Pintura exterior");
  // charged_to_owner: click the "Sí" radio (explicit choice)
  await userEvent.click(screen.getByRole("radio", { name: /^sí$/i }));
}

// ── R21: Visibility by role ───────────────────────────────────────────────────

describe("RegisterExpenseButton — R21 role visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
  });

  it("renders 'Registrar gasto' button when role = admin", () => {
    render(<RegisterExpenseButton propertyId="prop-1" />, { wrapper });
    expect(screen.getByRole("button", { name: /registrar gasto/i })).toBeInTheDocument();
  });

  it("does NOT render the button when role = agent", () => {
    mockAuthState.role = "agent";
    render(<RegisterExpenseButton propertyId="prop-1" />, { wrapper });
    expect(screen.queryByRole("button", { name: /registrar gasto/i })).not.toBeInTheDocument();
  });
});

// ── R22: Form field rendering ─────────────────────────────────────────────────

describe("ExpenseFormDialog — R22 field rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
  });

  it("renders type selector, amount input, currency selector, date input, description textarea, charged_to_owner radio group, and file input", () => {
    renderDialog();

    // Native selects rendered by the Select mock
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2); // type + currency

    // Amount field
    expect(screen.getByLabelText(/monto/i)).toBeInTheDocument();

    // Date field
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();

    // Description textarea
    expect(screen.getByLabelText(/descripci[oó]n/i)).toBeInTheDocument();

    // charged_to_owner radio group — both options present
    expect(screen.getByRole("radio", { name: /^sí$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^no$/i })).toBeInTheDocument();

    // File input for receipt
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it("neither Sí nor No radio is pre-selected (no default — ADR-4)", () => {
    renderDialog();
    expect(screen.getByRole("radio", { name: /^sí$/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /^no$/i })).not.toBeChecked();
  });
});

// ── R23: Validation ───────────────────────────────────────────────────────────

describe("ExpenseFormDialog — R23 validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
  });

  it("shows a validation error and blocks submit when amount is missing", async () => {
    renderDialog();
    // Submit without filling any field
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      // Any validation message about amount or required fields
      expect(screen.getAllByText(/requerido|required/i).length).toBeGreaterThan(0);
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("shows a validation error and blocks submit when amount is 0", async () => {
    renderDialog();
    // Fill all fields except put 0 as amount
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "arreglo");
    await userEvent.clear(screen.getByLabelText(/monto/i));
    await userEvent.type(screen.getByLabelText(/monto/i), "0");
    await userEvent.selectOptions(selects[1], "ARS");
    const dateInput = screen.getByLabelText(/fecha/i);
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, "2026-06-04");
    await userEvent.type(screen.getByLabelText(/descripci[oó]n/i), "Prueba");
    // charged_to_owner: click the "Sí" radio (explicit choice)
    await userEvent.click(screen.getByRole("radio", { name: /^sí$/i }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      // The refine error message MUST be visible in the DOM (R23 — "a validation error is shown")
      expect(screen.getByText(/mayor a cero/i)).toBeInTheDocument();
      expect(mockMutateAsync).not.toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it("calls mutateAsync with correct payload on valid submit (charged_to_owner: true)", async () => {
    mockMutateAsync.mockResolvedValue({ id: "exp-new" });

    renderDialog();
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce(), { timeout: 3000 });

    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      property_id: "prop-1",
      type: "arreglo",
      amount: 3500,
      currency: "ARS",
      description: "Pintura exterior",
      charged_to_owner: true,
    });
    // R20: receipt_path must be a storage key (not a URL), or null
    if (payload.receipt_path) {
      expect(payload.receipt_path).not.toMatch(/^https?:\/\//);
    }
  });

  it("sends charged_to_owner: false when user selects 'No' radio (explicit false path)", async () => {
    mockMutateAsync.mockResolvedValue({ id: "exp-no" });

    renderDialog();
    // Fill all required fields, but select "No" for charged_to_owner
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "arreglo");
    await userEvent.clear(screen.getByLabelText(/monto/i));
    await userEvent.type(screen.getByLabelText(/monto/i), "1000");
    await userEvent.selectOptions(selects[1], "ARS");
    const dateInput = screen.getByLabelText(/fecha/i);
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, "2026-06-04");
    await userEvent.type(screen.getByLabelText(/descripci[oó]n/i), "Gasto interno");
    await userEvent.click(screen.getByRole("radio", { name: /^no$/i }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce(), { timeout: 3000 });

    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      charged_to_owner: false,
    });
  });
});

// ── R24: Upload-then-insert ordering ─────────────────────────────────────────

describe("ExpenseFormDialog — R24 upload ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
  });

  it("if useUploadReceipt rejects, mutateAsync is never called", async () => {
    mockUploadMutateAsync.mockRejectedValue(new Error("Upload failed"));

    renderDialog();
    await fillValidForm();

    // Attach a file to trigger the upload path
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "receipt.jpg", { type: "image/jpeg" });
    await userEvent.upload(fileInput, file);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockUploadMutateAsync).toHaveBeenCalled();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});

// ── R25: Success + failure feedback ──────────────────────────────────────────

describe("ExpenseFormDialog — R25 feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.role = "admin";
  });

  it("calls onSuccess callback after successful mutateAsync", async () => {
    mockMutateAsync.mockResolvedValue({ id: "ok" });
    const onSuccess = vi.fn();
    renderDialog({ onSuccess });

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce(), { timeout: 3000 });
  });

  it("shows error alert and keeps dialog open on mutateAsync failure", async () => {
    mockMutateAsync.mockRejectedValue(new Error("DB error"));
    const onSuccess = vi.fn();
    renderDialog({ onSuccess });

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    // Dialog still open — Guardar button still rendered
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });
});
