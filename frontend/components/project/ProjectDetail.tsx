"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { Project, Todo, TodoStatus, WorkSession } from "@/lib/types";
import { useTodos } from "@/lib/hooks/useTodos";
import { useSessions } from "@/lib/hooks/useSessions";
import { LLMCopyButton } from "@/components/common/LLMCopyButton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { ProjectStats } from "./ProjectStats";
import { generateProjectPrompt } from "@/lib/llm-prompt";

const STATUS_ORDER: TodoStatus[] = [
  "in_progress",
  "review",
  "ready_for_code",
  "waiting",
  "ready_for_publish",
  "todo",
  "backlog",
  "done",
];

const STATUS_LABELS: Record<TodoStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  ready_for_code: "Ready for Code",
  in_progress: "In Progress",
  review: "Review",
  waiting: "Waiting",
  ready_for_publish: "Pending Publish",
  done: "Done",
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  done: "Done",
};

interface Props {
  project: Project;
}

export function ProjectDetail({ project }: Props) {
  const { data: todosData } = useTodos({ project_id: project.id });
  const { data: sessionsData } = useSessions({ project_id: project.id });
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  const todos: Todo[] = todosData?.todos ?? [];
  const sessions: WorkSession[] = sessionsData?.sessions ?? [];

  const grouped = STATUS_ORDER.reduce(
    (acc, status) => {
      const items = todos.filter((t) => t.status === status);
      if (items.length > 0) acc[status] = items;
      return acc;
    },
    {} as Record<TodoStatus, Todo[]>
  );

  const handleGeneratePrompt = useCallback(
    () => generateProjectPrompt(project, todos, sessions),
    [project, todos, sessions]
  );

  const [refInserted, setRefInserted] = useState(false);
  const refTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleInsertRef() {
    window.dispatchEvent(
      new CustomEvent("taskflow:insert-ref", {
        detail: { type: "project", id: project.id, title: project.name },
      }),
    );
    setRefInserted(true);
    if (refTimerRef.current) clearTimeout(refTimerRef.current);
    refTimerRef.current = setTimeout(() => setRefInserted(false), 1500);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: project.color || "#6366f1" }}
          />
          <div>
            <h1 className="text-xl font-bold text-gray-100">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-gray-400 mt-1">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInsertRef}
            title="チャットに参照を挿入"
            className={`p-1.5 rounded transition-colors ${refInserted ? "text-purple-400" : "text-gray-500 hover:text-gray-300"}`}
          >
            {refInserted ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </button>
          <LLMCopyButton generatePrompt={handleGeneratePrompt} />
        </div>
      </div>

      {/* Stats */}
      <ProjectStats project={project} todos={todos} />

      {/* Tasks by status */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Tasks
        </h2>
        {Object.entries(grouped).length === 0 ? (
          <div className="text-sm text-gray-500">タスクがありません</div>
        ) : (
          Object.entries(grouped).map(([status, items]) => {
            const isDone = status === "done";
            const collapsed = isDone && doneCollapsed;

            return (
              <div key={status} className="space-y-1">
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-300"
                  onClick={() => isDone && setDoneCollapsed((v) => !v)}
                >
                  {isDone && (
                    <span
                      className="transition-transform"
                      style={{
                        display: "inline-block",
                        transform: collapsed
                          ? "rotate(-90deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      ▼
                    </span>
                  )}
                  {STATUS_LABELS[status as TodoStatus]} ({items.length})
                </button>

                {!collapsed && (
                  <div className="space-y-1 ml-2">
                    {items.map((todo) => (
                      <Link
                        key={todo.id}
                        href={`/tasks/${todo.id}`}
                        className="flex items-center gap-3 px-3 py-2 bg-[#252540] rounded hover:bg-[#2a2a4a] transition-colors"
                      >
                        <StatusBadge status={todo.status} />
                        <span className="text-sm text-gray-200 flex-1 truncate">
                          {todo.title}
                        </span>
                        <PriorityBadge priority={todo.priority} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Sessions
          </h2>
          <div className="space-y-1">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between px-3 py-2 bg-[#252540] rounded hover:bg-[#2a2a4a] transition-colors"
              >
                <span className="text-sm text-gray-200 truncate">
                  {session.title}
                </span>
                <span
                  className={`text-xs font-medium ${
                    session.status === "active"
                      ? "text-green-400"
                      : session.status === "paused"
                        ? "text-amber-400"
                        : "text-gray-500"
                  }`}
                >
                  {SESSION_STATUS_LABELS[session.status] ?? session.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
