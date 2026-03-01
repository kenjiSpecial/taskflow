import { signal, computed } from "@preact/signals";
import type { Project, CreateProjectInput, UpdateProjectInput } from "../lib/api";
import * as api from "../lib/api";

export const projects = signal<Project[]>([]);
export const showArchived = signal(false);
export const loading = signal(false);
export const error = signal<string | null>(null);

export const visibleProjects = computed(() =>
  showArchived.value
    ? projects.value
    : projects.value.filter((p) => !p.archived_at),
);

export async function loadProjects() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.fetchProjects({ include_archived: "true" });
    projects.value = res.projects;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

export async function addProject(data: CreateProjectInput) {
  const res = await api.createProject(data);
  projects.value = [...projects.value, { ...res.project, todo_count: 0, session_active_count: 0, session_paused_count: 0, session_done_count: 0 }];
  return res.project;
}

export async function editProject(id: string, data: UpdateProjectInput) {
  const res = await api.updateProject(id, data);
  projects.value = projects.value.map((p) => (p.id === id ? { ...p, ...res.project } : p));
}

export async function archiveProject(id: string) {
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  await editProject(id, { archived_at: ts });
}

export async function unarchiveProject(id: string) {
  await editProject(id, { archived_at: null });
}

export async function removeProject(id: string) {
  await api.deleteProject(id);
  projects.value = projects.value.filter((p) => p.id !== id);
}
