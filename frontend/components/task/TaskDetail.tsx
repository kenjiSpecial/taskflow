"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StatusDot } from "@/components/common/StatusBadge";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { LLMCopyButton } from "@/components/common/LLMCopyButton";
import { SubTaskList } from "./SubTaskList";
import { useUpdateTodo } from "@/lib/hooks/useTodos";
import { generateTaskPrompt } from "@/lib/llm-prompt";
import { fetchTodoSessions } from "@/lib/api";
import type { Todo, TodoStatus } from "@/lib/types";

const STATUSES: { value: TodoStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ja-JP");
}

export function TaskDetail({ todo }: { todo: Todo }) {
  const updateTodo = useUpdateTodo();

  const { data: sessionsData } = useQuery({
    queryKey: ["todos", "sessions", todo.id],
    queryFn: () => fetchTodoSessions(todo.id),
  });

  const sessions = sessionsData?.sessions ?? [];

  const handleGeneratePrompt = useCallback(
    () => generateTaskPrompt(todo, todo.children, sessions),
    [todo, sessions],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <StatusDot status={todo.status} />
          <select
            value={todo.status}
            onChange={(e) =>
              updateTodo.mutate({
                id: todo.id,
                input: { status: e.target.value as TodoStatus },
              })
            }
            className="bg-[#252540] text-gray-100 text-sm rounded-md px-2 py-1 border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <h2 className="text-xl font-bold text-gray-100">{todo.title}</h2>
        {todo.description && (
          <p className="text-sm text-gray-400 whitespace-pre-wrap">
            {todo.description}
          </p>
        )}
        <div className="flex items-center gap-2">
          <LLMCopyButton generatePrompt={handleGeneratePrompt} />
          <Link
            href={`/tasks/${todo.id}/edit`}
            className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Properties grid */}
      <div className="grid grid-cols-2 gap-4 bg-[#1a1a2e] rounded-lg p-4">
        <div>
          <span className="block text-xs text-gray-400 mb-1">Project</span>
          {todo.project_id ? (
            <Link
              href={`/projects/${todo.project_id}`}
              className="text-sm text-blue-400 hover:underline"
            >
              {todo.project ?? todo.project_id}
            </Link>
          ) : (
            <span className="text-sm text-gray-500">-</span>
          )}
        </div>
        <div>
          <span className="block text-xs text-gray-400 mb-1">Priority</span>
          <PriorityBadge priority={todo.priority} />
        </div>
        <div>
          <span className="block text-xs text-gray-400 mb-1">Due date</span>
          <span className="text-sm text-gray-100">
            {formatDate(todo.due_date)}
          </span>
        </div>
        <div>
          <span className="block text-xs text-gray-400 mb-1">Tags</span>
          {(todo.tags ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(todo.tags ?? []).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: tag.color
                      ? `${tag.color}20`
                      : "rgba(107,114,128,0.2)",
                    color: tag.color ?? "#9ca3af",
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-500">-</span>
          )}
        </div>
      </div>

      {/* Sub Tasks */}
      {todo.children && todo.children.length > 0 && (
        <SubTaskList>{todo.children}</SubTaskList>
      )}

      {/* Sessions */}
      {sessions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Linked Sessions
          </h3>
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex flex-col gap-1 px-3 py-2 rounded-md bg-[#252540] hover:bg-[#2f2f50] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-100">
                    {session.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    {session.status}
                  </span>
                </div>
                {session.recent_logs && session.recent_logs.length > 0 && (
                  <p className="text-xs text-gray-500 truncate">
                    {session.recent_logs[0].content}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
