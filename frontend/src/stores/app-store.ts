import { signal } from "@preact/signals";

export const expandedSessionId = signal<string | null>(null);
export const expandedTaskProjects = signal<Set<string>>(new Set());
export const doneExpandedProjects = signal<Set<string>>(new Set());

// カード型レイアウト: バッジ展開状態
export const badgeExpandedProjects = signal<Map<string, Set<"paused" | "done">>>(new Map());

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

export function toggleBadgeExpanded(projectId: string, status: "paused" | "done") {
  const m = new Map(badgeExpandedProjects.value);
  const current = m.get(projectId) ?? new Set();
  const next = new Set(current);
  if (next.has(status)) {
    next.delete(status);
  } else {
    next.add(status);
  }
  if (next.size === 0) {
    m.delete(projectId);
  } else {
    m.set(projectId, next);
  }
  badgeExpandedProjects.value = m;
}
