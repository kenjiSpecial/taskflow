"use client";

import { useMemo } from "react";
import type { Todo, TodoStatus } from "@/lib/types";
import { useTodos, useUpdateTodo } from "@/lib/hooks/useTodos";
import { useProjects } from "@/lib/hooks/useProjects";
import { KanbanColumn } from "./KanbanColumn";

const COLUMNS: TodoStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
];

export function KanbanBoard() {
  const { data: todosData, isLoading: todosLoading } = useTodos({
    limit: "200",
  });
  const { data: projectsData } = useProjects();
  const updateTodo = useUpdateTodo();

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
        if (map[todo.status]) {
          map[todo.status].push(todo);
        }
      }
    }
    return map;
  }, [todosData]);

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
  );
}
