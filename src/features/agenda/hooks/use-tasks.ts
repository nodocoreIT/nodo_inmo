import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import type { Database } from "@/shared/types/database";

export type TaskRow = Database["nodo_inmo"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["nodo_inmo"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["nodo_inmo"]["Tables"]["tasks"]["Update"];

export type CreateTaskInput = Omit<TaskInsert, "org_id">;
export type UpdateTaskInput = Omit<TaskUpdate, "org_id"> & { id: string };

export const TASKS_QUERY_KEY = ["nodo_inmo", "tasks"] as const;

/** Fetch all tasks for the current organization, ordered by due_date ascending. */
export function useTasks() {
  const { orgId } = useAuth();

  return useQuery<TaskRow[]>({
    queryKey: [...TASKS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("tasks")
        .select("*")
        .eq("org_id", orgId)
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

/** Create a new task in the organization. */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      if (!orgId) throw new Error("No org_id — user not authenticated");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("tasks")
        .insert({ ...input, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

/** Update an existing task's status, details, or assignee. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateTaskInput) => {
      if (!orgId) throw new Error("No org_id — user not authenticated");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("tasks")
        .update({ ...input })
        .eq("id", input.id)
        .eq("org_id", orgId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

/** Delete a task. */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!orgId) throw new Error("No org_id — user not authenticated");

      const { error } = await supabase
        .schema("nodo_inmo")
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("org_id", orgId);

      if (error) throw error;
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}
