"use client";

import type { Todo, TodoStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";

const STATUS_LABEL: Record<TodoStatus, string> = {
  backlog: "BACKLOG",
  todo: "TODO",
  in_progress: "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
};

const STATUS_BADGE_COLOR: Record<TodoStatus, string> = {
  backlog: "bg-gray-600 text-gray-300",
  todo: "bg-blue-900 text-blue-300",
  in_progress: "bg-amber-900 text-amber-300",
  review: "bg-purple-900 text-purple-300",
  done: "bg-green-900 text-green-300",
};

interface KanbanColumnProps {
  status: TodoStatus;
  todos: Todo[];
  projectMap: Map<string, string>;
  onDrop: (todoId: string, newStatus: TodoStatus) => void;
}

export function KanbanColumn({
  status,
  todos,
  projectMap,
  onDrop,
}: KanbanColumnProps) {
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const todoId = e.dataTransfer.getData("text/plain");
    if (todoId) {
      onDrop(todoId, status);
    }
  }

  return (
    <div
      className="flex-shrink-0 w-64 bg-[#1a1a2e] rounded-xl p-3 flex flex-col max-h-[calc(100vh-8rem)]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-xs font-bold tracking-wider text-gray-400">
          {STATUS_LABEL[status]}
        </h2>
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE_COLOR[status]}`}
        >
          {todos.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-[60px]">
        {todos.map((todo) => (
          <TaskCard
            key={todo.id}
            todo={todo}
            projectName={
              todo.project_id
                ? projectMap.get(todo.project_id)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
