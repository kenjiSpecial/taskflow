"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { CreateTodoInput, UpdateTodoInput, ReorderItem } from "../types";

export const todoKeys = {
  all: ["todos"] as const,
  list: (params?: Record<string, unknown>) =>
    [...todoKeys.all, "list", params] as const,
  detail: (id: string) => [...todoKeys.all, "detail", id] as const,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
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
