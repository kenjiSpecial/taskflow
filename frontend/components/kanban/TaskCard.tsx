"use client";

import Link from "next/link";
import type { Todo, TodoStatus } from "@/lib/types";
import { PriorityBadge } from "@/components/common/PriorityBadge";

const STATUS_BORDER_COLOR: Record<TodoStatus, string> = {
  backlog: "border-l-gray-400",
  todo: "border-l-blue-400",
  ready_for_code: "border-l-cyan-400",
  in_progress: "border-l-amber-400",
  review: "border-l-purple-400",
  done: "border-l-green-400",
};

interface TaskCardProps {
  todo: Todo;
  projectName?: string;
}

export function TaskCard({ todo, projectName }: TaskCardProps) {
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
    <Link href={`/tasks/${todo.id}`} className="block">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`bg-[#252540] rounded-lg p-3 border-l-4 ${STATUS_BORDER_COLOR[todo.status]} cursor-grab active:cursor-grabbing hover:bg-[#2d2d50] transition-all`}
      >
        <p className="text-sm text-gray-100 font-medium leading-snug">
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
