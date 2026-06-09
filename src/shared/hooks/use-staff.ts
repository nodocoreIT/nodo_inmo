import { create } from "zustand";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const DEFAULT_USERS: MockUser[] = [
  {
    id: "1",
    name: "Ramiro Tule",
    email: "ramiro@nodoinmo.com",
    role: "Nodo Administrador",
    status: "Activo",
  },
  {
    id: "2",
    name: "Juan Colega",
    email: "juan@inmobiliaria.com",
    role: "Nodo Colega",
    status: "Activo",
  },
];

interface StaffStore {
  users: MockUser[];
  inviteUser: (name: string, email: string, role: string) => Promise<void>;
  resetUsers: () => void;
}

const getInitialUsers = (): MockUser[] => {
  try {
    const stored = localStorage.getItem("nodo-mock-users");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignored
  }
  return DEFAULT_USERS;
};

export const useStaffStore = create<StaffStore>((set) => ({
  users: getInitialUsers(),
  inviteUser: (name, email, role) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        set((state) => {
          const next = [
            ...state.users,
            {
              id: Date.now().toString(),
              name,
              email,
              role,
              status: "Pendiente",
            },
          ];
          try {
            localStorage.setItem("nodo-mock-users", JSON.stringify(next));
          } catch {
            // Ignored
          }
          return { users: next };
        });
        resolve();
      }, 1000);
    });
  },
  resetUsers: () => {
    try {
      localStorage.removeItem("nodo-mock-users");
    } catch {
      // Ignored
    }
    set({ users: DEFAULT_USERS });
  },
}));

export function useStaff() {
  const { users, inviteUser, resetUsers } = useStaffStore();
  return { users, inviteUser, resetUsers };
}
