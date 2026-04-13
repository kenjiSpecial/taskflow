"use client";

import Link from "next/link";
import { StatusDot } from "@/components/common/StatusBadge";
import type { Todo, TodoStatus } from "@/lib/types";

const STATUS_LABELS: Record<TodoStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  ready_for_code: "Ready for Code",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export function SubTaskList({ children }: { children: Todo[] }) {
  if (children.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Sub Tasks</h3>
      <div className="flex flex-col gap-2">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/tasks/${child.id}`}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#252540] hover:bg-[#2f2f50] transition-colors"
          >
            <StatusDot status={child.status} />
            <span className="flex-1 text-sm text-gray-100 truncate">
              {child.title}
            </span>
            <span className="text-xs text-gray-400">
              {STATUS_LABELS[child.status]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
