"use client";

import { useMemo, useState } from "react";
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

export function KanbanBoard() {
  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterTagId, setFilterTagId] = useState<string>("");

  const { data: todosData, isLoading: todosLoading } = useTodos({
    limit: "200",
  });
  const { data: projectsData } = useProjects();
  const { data: tagsData } = useTags();
  const updateTodo = useUpdateTodo();

  // プロジェクトID → タグIDリストのマップ（タグフィルタ用）
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
        if (filterTagId && (!todo.project_id || !projectTagMap.get(todo.project_id)?.includes(filterTagId))) continue;
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

  function handleDrop(todoId: string, newStatus: TodoStatus) {
    updateTodo.mutate({
      id: todoId,
      input: {
        status: newStatus,
        done_at: newStatus === "done" ? new Date().toISOString() : null,
      },
    });
  }

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
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterTagId}
          onChange={(e) => setFilterTagId(e.target.value)}
          className="bg-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-gray-500"
        >
          <option value="">すべてのタグ</option>
          {tagsData?.tags?.map((t: { id: string; name: string }) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 overflow-x-auto p-4 pb-6">
        {COLUMNS.map((status) => (
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
