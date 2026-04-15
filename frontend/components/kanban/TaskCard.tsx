"use client";

import { useState } from "react";
import Link from "next/link";
import type { Todo, TodoStatus } from "@/lib/types";
import { PriorityBadge } from "@/components/common/PriorityBadge";

const STATUS_BORDER_COLOR: Record<TodoStatus, string> = {
  backlog: "border-l-gray-400",
  todo: "border-l-blue-400",
  ready_for_code: "border-l-cyan-400",
  in_progress: "border-l-amber-400",
  review: "border-l-purple-400",
  waiting: "border-l-yellow-400",
  ready_for_publish: "border-l-orange-400",
  done: "border-l-green-400",
};

interface TaskCardProps {
  todo: Todo;
  projectName?: string;
}

export function TaskCard({ todo, projectName }: TaskCardProps) {
  const [inserted, setInserted] = useState(false);

  function handleInsertRef(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("taskflow:insert-ref", {
        detail: { type: "task", id: todo.id, title: todo.title },
      }),
    );
    setInserted(true);
    setTimeout(() => setInserted(false), 1500);
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", todo.id);
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget;
    requestAnimationFrame(() => el.classList.add("opacity-40"));
  }

  function handleDragEnd(e: React.DragEvent<HTMLDivElement>) {
    e.currentTarget.classList.remove("opacity-40");
  }

  return (
    <Link href={`/tasks/${todo.id}`} className="block group">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`relative bg-[#252540] rounded-lg p-3 border-l-4 ${STATUS_BORDER_COLOR[todo.status]} cursor-grab active:cursor-grabbing hover:bg-[#2d2d50] transition-all`}
      >
        <button
          onClick={handleInsertRef}
          onMouseDown={(e) => e.stopPropagation()}
          title="チャットに参照を挿入"
          className={`absolute top-2 right-2 p-1 rounded transition-all ${inserted ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}
        >
          {inserted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>

        <p className="text-sm text-gray-100 font-medium leading-snug pr-5">
          {todo.title}
        </p>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={todo.priority} />

          {projectName && (
            <span className="text-xs text-gray-500 truncate max-w-[120px]">
              {projectName}
            </span>
          )}

          {todo.due_date && (
            <span className="text-xs text-gray-500 ml-auto">
              {new Date(todo.due_date).toLocaleDateString("ja-JP", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
