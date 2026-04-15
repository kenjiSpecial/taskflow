"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { UpsertWorkspaceInput, CreateWorkspacePathInput } from "../types";

export const workspaceKeys = {
  detail: (todoId: string) => ["workspace", todoId] as const,
};

export function useWorkspace(todoId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(todoId),
    queryFn: () => api.fetchWorkspace(todoId),
    retry: (failureCount, error) => {
      // "Workspace not found"はリトライしない（未作成は正常状態）
      // request()関数は404時に body.error.message をそのまま投げる
      if (error instanceof Error && error.message === "Workspace not found") return false;
      return failureCount < 2;
    },
  });
}

export function useUpsertWorkspace(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertWorkspaceInput) => api.upsertWorkspace(todoId, input),
    onSuccess: (data) => {
      qc.setQueryData(workspaceKeys.detail(todoId), data);
    },
  });
}

export function useDeleteWorkspace(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteWorkspace(todoId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: workspaceKeys.detail(todoId) });
    },
  });
}

export function useAddWorkspacePath(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspacePathInput) => api.addWorkspacePath(todoId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(todoId) });
    },
  });
}

export function useDeleteWorkspacePath(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pathId: string) => api.deleteWorkspacePath(todoId, pathId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(todoId) });
    },
  });
}
