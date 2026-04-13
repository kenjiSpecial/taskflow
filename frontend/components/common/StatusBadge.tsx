"use client";

import type { TodoStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  TodoStatus,
  { label: string; color: string; dotColor: string }
> = {
  backlog: { label: "Backlog", color: "text-gray-400", dotColor: "bg-gray-400" },
  todo: { label: "Todo", color: "text-blue-400", dotColor: "bg-blue-400" },
  ready_for_code: {
    label: "Ready for Code",
    color: "text-cyan-400",
    dotColor: "bg-cyan-400",
  },
  in_progress: {
    label: "In Progress",
    color: "text-amber-400",
    dotColor: "bg-amber-400",
  },
  review: {
    label: "Review",
    color: "text-purple-400",
    dotColor: "bg-purple-400",
  },
  ready_for_publish: {
    label: "Pending Publish",
    color: "text-orange-400",
    dotColor: "bg-orange-400",
  },
  done: { label: "Done", color: "text-green-400", dotColor: "bg-green-400" },
};

export function StatusBadge({ status }: { status: TodoStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

export function StatusDot({ status }: { status: TodoStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`w-2 h-2 rounded-full ${config.dotColor}`}
      title={config.label}
    />
  );
}
