"use client";

import type { Project, Todo } from "@/lib/types";

interface Props {
  project: Project;
  todos: Todo[];
}

export function ProjectStats({ project, todos }: Props) {
  const total = todos.length;
  const inProgress = todos.filter(
    (t) => t.status === "in_progress" || t.status === "review"
  ).length;
  const done = todos.filter((t) => t.status === "done").length;
  const sessionCount =
    project.session_active_count +
    project.session_paused_count +
    project.session_done_count;

  const cards = [
    { label: "タスク合計", value: total },
    { label: "進行中", value: inProgress },
    { label: "完了", value: done },
    { label: "セッション数", value: sessionCount },
  ];

  return (
    <div className="flex gap-4 flex-wrap">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex-1 min-w-[120px] bg-[#1a1a2e] rounded-lg p-4"
        >
          <div className="text-xs text-gray-400 mb-1">{card.label}</div>
          <div className="text-2xl font-bold text-gray-100">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
