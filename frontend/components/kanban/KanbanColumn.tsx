"use client";

import { useState } from "react";
import type { Todo, TodoStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";

const STATUS_LABEL: Record<TodoStatus, string> = {
  backlog: "BACKLOG",
  todo: "TODO",
  ready_for_code: "READY FOR CODE",
  in_progress: "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
};

const STATUS_BADGE_COLOR: Record<TodoStatus, string> = {
  backlog: "bg-gray-600 text-gray-300",
  todo: "bg-blue-900 text-blue-300",
  ready_for_code: "bg-cyan-900 text-cyan-300",
  in_progress: "bg-amber-900 text-amber-300",
  review: "bg-purple-900 text-purple-300",
  done: "bg-green-900 text-green-300",
};

const STATUS_HIGHLIGHT: Record<TodoStatus, string> = {
  backlog: "ring-gray-400/50 bg-gray-800/30",
  todo: "ring-blue-400/50 bg-blue-900/20",
  ready_for_code: "ring-cyan-400/50 bg-cyan-900/20",
  in_progress: "ring-amber-400/50 bg-amber-900/20",
  review: "ring-purple-400/50 bg-purple-900/20",
  done: "ring-green-400/50 bg-green-900/20",
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragCounter((c) => {
      if (c === 0) setIsDragOver(true);
      return c + 1;
    });
  }

  function handleDragLeave() {
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) {
        setIsDragOver(false);
        return 0;
      }
      return next;
    });
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    setDragCounter(0);
    const todoId = e.dataTransfer.getData("text/plain");
    if (todoId) {
      onDrop(todoId, status);
    }
  }

  return (
    <div
      className={`flex-shrink-0 w-64 rounded-xl p-3 flex flex-col max-h-[calc(100vh-8rem)] transition-all duration-150 ${
        isDragOver
          ? `bg-[#1e1e38] ring-2 ${STATUS_HIGHLIGHT[status]}`
          : "bg-[#1a1a2e]"
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2
          className={`text-xs font-bold tracking-wider transition-colors ${
            isDragOver ? "text-white" : "text-gray-400"
          }`}
        >
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
              todo.project_id ? projectMap.get(todo.project_id) : undefined
            }
          />
        ))}
        {isDragOver && todos.length === 0 && (
          <div className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-gray-600 text-gray-500 text-xs">
            ここにドロップ
          </div>
        )}
      </div>
    </div>
  );
}
