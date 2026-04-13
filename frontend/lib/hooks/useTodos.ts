"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { CreateTodoInput, UpdateTodoInput, ReorderItem } from "../types";

export const todoKeys = {
  all: ["todos"] as const,
  list: (params?: Record<string, unknown>) =>
    [...todoKeys.all, "list", params] as const,
  detail: (id: string) => [...todoKeys.all, "detail", id] as const,
  logs: (id: string) => [...todoKeys.all, "logs", id] as const,
};

export function useTodos(params?: Record<string, string>) {
  return useQuery({
    queryKey: todoKeys.list(params),
    queryFn: () => api.fetchTodos(params),
  });
}

export function useTodo(id: string) {
  return useQuery({
    queryKey: todoKeys.detail(id),
    queryFn: () => api.fetchTodo(id),
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoInput) => api.createTodo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTodoInput }) =>
      api.updateTodo(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: todoKeys.all });
      const previousData = qc.getQueriesData({ queryKey: todoKeys.all });
      // Optimistically update all matching caches
      qc.setQueriesData<{ todos: import("../types").Todo[] }>(
        { queryKey: todoKeys.all },
        (old) => {
          if (!old?.todos) return old;
          return {
            ...old,
            todos: old.todos.map((t) =>
              t.id === id ? { ...t, ...input } : t,
            ),
          };
        },
      );
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTodo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useReorderTodos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => api.reorderTodos(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useTodoLogs(todoId: string) {
  return useQuery({
    queryKey: todoKeys.logs(todoId),
    queryFn: () => api.fetchTodoLogs(todoId),
  });
}

export function useAddTodoLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ todoId, content, source }: { todoId: string; content: string; source?: "human" | "ai" }) =>
      api.addTodoLog(todoId, { content, source }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: todoKeys.logs(vars.todoId) });
      qc.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}
