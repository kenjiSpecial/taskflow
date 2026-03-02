import { signal } from "@preact/signals";

export const expandedSessionId = signal<string | null>(null);
export const expandedTaskProjects = signal<Set<string>>(new Set());
export const doneExpandedProjects = signal<Set<string>>(new Set());

// プロジェクト詳細ページ用
export const detailExpandedSessionId = signal<string | null>(null);

export function toggleTasksExpanded(projectId: string) {
  const s = new Set(expandedTaskProjects.value);
  if (s.has(projectId)) {
    s.delete(projectId);
  } else {
    s.add(projectId);
  }
  expandedTaskProjects.value = s;
}

export function toggleDoneExpanded(projectId: string) {
  const s = new Set(doneExpandedProjects.value);
  if (s.has(projectId)) {
    s.delete(projectId);
  } else {
    s.add(projectId);
  }
  doneExpandedProjects.value = s;
}
