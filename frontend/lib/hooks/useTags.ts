"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { CreateTagInput, UpdateTagInput } from "../types";
import { todoKeys } from "./useTodos";
import { projectKeys } from "./useProjects";

export const tagKeys = {
  all: ["tags"] as const,
  list: () => [...tagKeys.all, "list"] as const,
};

export function useTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: () => api.fetchTags(),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTagInput) => api.createTag(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTagInput }) =>
      api.updateTag(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useLinkProjectTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      tagId,
    }: {
      projectId: string;
      tagId: string;
    }) => api.linkProjectTag(projectId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUnlinkProjectTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      tagId,
    }: {
      projectId: string;
      tagId: string;
    }) => api.unlinkProjectTag(projectId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useLinkTodoTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ todoId, tagId }: { todoId: string; tagId: string }) =>
      api.linkTodoTag(todoId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}

export function useUnlinkTodoTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ todoId, tagId }: { todoId: string; tagId: string }) =>
      api.unlinkTodoTag(todoId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}
