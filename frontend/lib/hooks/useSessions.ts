"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { CreateSessionInput, UpdateSessionInput } from "../types";

export const sessionKeys = {
  all: ["sessions"] as const,
  list: (params?: Record<string, unknown>) =>
    [...sessionKeys.all, "list", params] as const,
  detail: (id: string) => [...sessionKeys.all, "detail", id] as const,
  logs: (sessionId: string) =>
    [...sessionKeys.all, "logs", sessionId] as const,
  tasks: (sessionId: string) =>
    [...sessionKeys.all, "tasks", sessionId] as const,
};

export function useSessions(params?: Record<string, string>) {
  return useQuery({
    queryKey: sessionKeys.list(params),
    queryFn: () => api.fetchSessions(params),
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: sessionKeys.detail(id),
    queryFn: () => api.fetchSession(id),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSessionInput) => api.createSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateSessionInput;
    }) => api.updateSession(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useSessionLogs(
  sessionId: string,
  params?: Record<string, string>,
) {
  return useQuery({
    queryKey: sessionKeys.logs(sessionId),
    queryFn: () => api.fetchSessionLogs(sessionId, params),
  });
}

export function useAddSessionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: { content: string; source?: string };
    }) => api.createSessionLog(sessionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useSessionTasks(sessionId: string) {
  return useQuery({
    queryKey: sessionKeys.tasks(sessionId),
    queryFn: () => api.fetchSessionTasks(sessionId),
  });
}

export function useLinkSessionTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      todoId,
    }: {
      sessionId: string;
      todoId: string;
    }) => api.linkSessionTask(sessionId, todoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useUnlinkSessionTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      todoId,
    }: {
      sessionId: string;
      todoId: string;
    }) => api.unlinkSessionTask(sessionId, todoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}
