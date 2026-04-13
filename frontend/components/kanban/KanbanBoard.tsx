"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import type { Todo, TodoStatus } from "@/lib/types";
import { useTodos, useUpdateTodo } from "@/lib/hooks/useTodos";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTags } from "@/lib/hooks/useTags";
import { KanbanColumn } from "./KanbanColumn";

const COLUMNS: TodoStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
];

const STORAGE_KEY = "taskflow-kanban-filters";

function loadFilters(): {
  projectId: string;
  tagId: string;
  showDone: boolean;
} {
  if (typeof window === "undefined") return { projectId: "", tagId: "", showDone: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { projectId: "", tagId: "", showDone: false };
}

export function KanbanBoard() {
  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterTagId, setFilterTagId] = useState<string>("");
  const [showDone, setShowDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // localStorage読み込み（初回のみ）
  useEffect(() => {
    const saved = loadFilters();
    setFilterProjectId(saved.projectId);
    setFilterTagId(saved.tagId);
    setShowDone(saved.showDone);
    setHydrated(true);
  }, []);

  // localStorage書き込み
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectId: filterProjectId, tagId: filterTagId, showDone }),
    );
  }, [filterProjectId, filterTagId, showDone, hydrated]);

  const { data: todosData, isLoading: todosLoading } = useTodos({
    limit: "200",
  });
  const { data: projectsData } = useProjects();
  const { data: tagsData } = useTags();
  const updateTodo = useUpdateTodo();

  const projectTagMap = useMemo(() => {
    const m = new Map<string, string[]>();
    if (projectsData?.projects) {
      for (const p of projectsData.projects) {
        if (p.tags?.length) {
          m.set(
            p.id,
            p.tags.map((t) => t.id),
          );
        }
      }
    }
    return m;
  }, [projectsData]);

  const grouped = useMemo(() => {
    const map: Record<TodoStatus, Todo[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    if (todosData?.todos) {
      for (const todo of todosData.todos) {
        if (filterProjectId && todo.project_id !== filterProjectId) continue;
        if (
          filterTagId &&
          (!todo.project_id ||
            !projectTagMap.get(todo.project_id)?.includes(filterTagId))
        )
          continue;
        if (map[todo.status]) {
          map[todo.status].push(todo);
        }
      }
    }
    return map;
  }, [todosData, filterProjectId, filterTagId, projectTagMap]);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    if (projectsData?.projects) {
      for (const p of projectsData.projects) {
        m.set(p.id, p.name);
      }
    }
    return m;
  }, [projectsData]);

  const handleDrop = useCallback(
    (todoId: string, newStatus: TodoStatus) => {
      updateTodo.mutate({
        id: todoId,
        input: {
          status: newStatus,
          done_at: newStatus === "done" ? new Date().toISOString() : null,
        },
      });
    },
    [updateTodo],
  );

  if (todosLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 px-4 pt-4">
        <select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          className="bg-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-gray-500"
        >
          <option value="">すべてのプロジェクト</option>
          {projectsData?.projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filterTagId}
          onChange={(e) => setFilterTagId(e.target.value)}
          className="bg-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-gray-500"
        >
          <option value="">すべてのタグ</option>
          {tagsData?.tags?.map((t: { id: string; name: string }) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
            className="accent-green-500"
          />
          Done を表示
        </label>
      </div>
      <div className="flex gap-3 overflow-x-auto p-4 pb-6">
        {COLUMNS.filter((s) => s !== "done" || showDone).map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            todos={grouped[status]}
            projectMap={projectMap}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
