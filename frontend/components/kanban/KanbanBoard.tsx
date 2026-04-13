"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import type { Todo, TodoStatus, Project } from "@/lib/types";
import { useTodos, useUpdateTodo } from "@/lib/hooks/useTodos";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTags } from "@/lib/hooks/useTags";
import { KanbanColumn } from "./KanbanColumn";

const COLUMNS: TodoStatus[] = [
  "backlog",
  "todo",
  "ready_for_code",
  "in_progress",
  "review",
  "ready_for_publish",
  "done",
];

const STORAGE_KEY = "taskflow-kanban-filters";

type ViewMode = "unified" | "by-project";

function loadFilters(): {
  projectId: string;
  tagId: string;
  showDone: boolean;
  viewMode: ViewMode;
} {
  if (typeof window === "undefined")
    return { projectId: "", tagId: "", showDone: false, viewMode: "unified" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { projectId: "", tagId: "", showDone: false, viewMode: "unified" };
}

// プロジェクト別にtodoをグルーピング
function groupByProject(
  todos: Todo[],
  projects: Project[],
  filterTagId: string,
  projectTagMap: Map<string, string[]>,
): { project: Project; grouped: Record<TodoStatus, Todo[]> }[] {
  const result: { project: Project; grouped: Record<TodoStatus, Todo[]> }[] = [];

  for (const project of projects) {
    if (filterTagId && !projectTagMap.get(project.id)?.includes(filterTagId)) continue;

    const grouped: Record<TodoStatus, Todo[]> = {
      backlog: [],
      todo: [],
      ready_for_code: [],
      in_progress: [],
      review: [],
      ready_for_publish: [],
      done: [],
    };
    let hasAny = false;
    for (const todo of todos) {
      if (todo.project_id !== project.id) continue;
      if (grouped[todo.status]) {
        grouped[todo.status].push(todo);
        hasAny = true;
      }
    }
    if (hasAny) {
      result.push({ project, grouped });
    }
  }

  // プロジェクト未設定のタスク
  const noProject: Record<TodoStatus, Todo[]> = {
    backlog: [],
    todo: [],
    ready_for_code: [],
    in_progress: [],
    review: [],
    ready_for_publish: [],
    done: [],
  };
  let hasNoProject = false;
  for (const todo of todos) {
    if (!todo.project_id && noProject[todo.status]) {
      if (filterTagId) continue; // タグフィルタ時はプロジェクト未設定を除外
      noProject[todo.status].push(todo);
      hasNoProject = true;
    }
  }
  if (hasNoProject) {
    result.push({
      project: { id: "", name: "プロジェクト未設定" } as Project,
      grouped: noProject,
    });
  }

  return result;
}

// Done非表示時にドラッグ中のみ表示するミニドロップゾーン
function MiniDoneDropZone({ onDrop }: { onDrop: (todoId: string) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  return (
    <div
      className={`flex-shrink-0 w-20 rounded-xl flex flex-col items-center justify-center transition-all duration-150 border-2 border-dashed ${
        isDragOver
          ? "border-green-400 bg-green-900/30"
          : "border-green-700/50 bg-[#1a1a2e]/50"
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragCounter((c) => { if (c === 0) setIsDragOver(true); return c + 1; });
      }}
      onDragLeave={() => {
        setDragCounter((c) => { const n = c - 1; if (n <= 0) { setIsDragOver(false); return 0; } return n; });
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        setDragCounter(0);
        const todoId = e.dataTransfer.getData("text/plain");
        if (todoId) onDrop(todoId);
      }}
    >
      <span className={`text-xs font-bold tracking-wider ${isDragOver ? "text-green-300" : "text-green-600"}`}>
        DONE
      </span>
    </div>
  );
}

export function KanbanBoard() {
  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterTagId, setFilterTagId] = useState<string>("");
  const [showDone, setShowDone] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const [hydrated, setHydrated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ドラッグ検知（window level）
  useEffect(() => {
    const onDragStart = () => setIsDragging(true);
    const onDragEnd = () => setIsDragging(false);
    const onDrop = () => setIsDragging(false);
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    const saved = loadFilters();
    setFilterProjectId(saved.projectId);
    setFilterTagId(saved.tagId);
    setShowDone(saved.showDone);
    setViewMode(saved.viewMode ?? "unified");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectId: filterProjectId,
        tagId: filterTagId,
        showDone,
        viewMode,
      }),
    );
  }, [filterProjectId, filterTagId, showDone, viewMode, hydrated]);

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
          m.set(p.id, p.tags.map((t) => t.id));
        }
      }
    }
    return m;
  }, [projectsData]);

  // 一括表示用
  const grouped = useMemo(() => {
    const map: Record<TodoStatus, Todo[]> = {
      backlog: [],
      todo: [],
      ready_for_code: [],
      in_progress: [],
      review: [],
      ready_for_publish: [],
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

  // プロジェクト別表示用
  const byProject = useMemo(() => {
    if (filterProjectId || !projectsData?.projects || !todosData?.todos)
      return [];
    return groupByProject(
      todosData.todos,
      projectsData.projects,
      filterTagId,
      projectTagMap,
    );
  }, [todosData, projectsData, filterProjectId, filterTagId, projectTagMap]);

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

  const handleDropDone = useCallback(
    (todoId: string) => handleDrop(todoId, "done"),
    [handleDrop],
  );

  const showMiniDone = !showDone && isDragging;

  if (todosLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm">読み込み中...</div>
      </div>
    );
  }

  const isAllProjects = !filterProjectId;
  const activeColumns = COLUMNS.filter((s) => s !== "done" || showDone);

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
        {isAllProjects && (
          <div className="flex items-center gap-1 ml-auto bg-gray-800 rounded-md border border-gray-700 p-0.5">
            <button
              onClick={() => setViewMode("unified")}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === "unified"
                  ? "bg-gray-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              一括
            </button>
            <button
              onClick={() => setViewMode("by-project")}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === "by-project"
                  ? "bg-gray-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              プロジェクト別
            </button>
          </div>
        )}
      </div>

      {isAllProjects && viewMode === "by-project" ? (
        <div className="flex flex-col gap-6 p-4 pb-6">
          {byProject.map(({ project, grouped: pg }) => (
            <div key={project.id || "_none"}>
              <div className="flex items-center gap-2 mb-2 px-1">
                {project.color && (
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: project.color }}
                  />
                )}
                <h3 className="text-sm font-semibold text-gray-300">
                  {project.name}
                </h3>
              </div>
              <div className="flex gap-3 overflow-x-auto">
                {activeColumns.map((status) => (
                  <KanbanColumn
                    key={`${project.id}-${status}`}
                    status={status}
                    todos={pg[status]}
                    projectMap={projectMap}
                    onDrop={handleDrop}
                    sticky={status === "done"}
                  />
                ))}
                {showMiniDone && <MiniDoneDropZone onDrop={handleDropDone} />}
              </div>
            </div>
          ))}
          {byProject.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-8">
              タスクがありません
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto p-4 pb-6">
          {activeColumns.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              todos={grouped[status]}
              projectMap={projectMap}
              onDrop={handleDrop}
              sticky={status === "done"}
            />
          ))}
          {showMiniDone && <MiniDoneDropZone onDrop={handleDropDone} />}
        </div>
      )}
    </div>
  );
}
