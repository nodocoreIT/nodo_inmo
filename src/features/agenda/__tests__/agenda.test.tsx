import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock supabase BEFORE importing hooks
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(),
      })),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
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

// Mock feature hooks
const mockUseTasks = vi.fn();
vi.mock("@/features/agenda/hooks/use-tasks", () => ({
  useTasks: () => mockUseTasks(),
  useCreateTask: () => ({ mutateAsync: vi.fn() }),
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/features/properties/hooks/use-properties", () => ({
  useProperties: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/features/contacts/hooks/use-contacts", () => ({
  useContacts: () => ({ data: [], isLoading: false }),
}));

import { AgendaPage } from "../components/agenda-page";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("AgendaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state spinner", () => {
    mockUseTasks.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<AgendaPage />, { wrapper });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state message for the selected day", () => {
    mockUseTasks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<AgendaPage />, { wrapper });
    expect(
      screen.getByText(/no tenés tareas agendadas para este día/i)
    ).toBeInTheDocument();
  });

  it("renders tasks items and categories correctly", () => {
    const todayStr = new Date().toISOString().split("T")[0];
    mockUseTasks.mockReturnValue({
      data: [
        {
          id: "t-1",
          org_id: "org-1",
          title: "Firma de contrato de Callao 500",
          description: "Traer duplicados y sellos",
          category: "firma",
          priority: "alta",
          status: "pendiente",
          due_date: todayStr,
          assigned_to: "Ramiro Tule",
          property_id: null,
          contact_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AgendaPage />, { wrapper });

    expect(screen.getByText("Firma de contrato de Callao 500")).toBeInTheDocument();
    expect(screen.getByText("Traer duplicados y sellos")).toBeInTheDocument();
    expect(screen.getAllByText("Firma de Contrato").length).toBeGreaterThan(0); // Category badge
    expect(screen.getAllByText("Alta").length).toBeGreaterThan(0); // Priority badge
    expect(screen.getAllByText("Ramiro Tule").length).toBeGreaterThan(0); // Assignee badge
  });

  it("renders Nueva Tarea button", () => {
    mockUseTasks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<AgendaPage />, { wrapper });
    expect(
      screen.getByRole("button", { name: /nueva tarea/i })
    ).toBeInTheDocument();
  });
});
