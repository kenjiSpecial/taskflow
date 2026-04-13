"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { StatusDot } from "@/components/common/StatusBadge";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { LLMCopyButton } from "@/components/common/LLMCopyButton";
import { SubTaskList } from "./SubTaskList";
import { useUpdateTodo, useTodoLogs, useAddTodoLog } from "@/lib/hooks/useTodos";
import { generateTaskPrompt } from "@/lib/llm-prompt";
import { fetchTodoSessions } from "@/lib/api";
import type { Todo, TodoStatus, TodoLog } from "@/lib/types";

marked.use({ breaks: true, async: false });

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

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Inline Editable ---

function InlineText({
  value,
  onSave,
  className,
  as: Tag = "span",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  as?: "span" | "h2" | "p";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <Tag
        className={`${className} cursor-pointer hover:bg-gray-800/50 rounded px-1 -mx-1 transition-colors`}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || <span className="text-gray-600 italic">クリックして編集</span>}
      </Tag>
    );
  }

  return Tag === "p" || Tag === "span" ? (
    <textarea
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      className={`${className} w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500 resize-none`}
      rows={3}
    />
  ) : (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      className={`${className} w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500`}
    />
  );
}

// --- Log Entry ---

function LogEntry({ log }: { log: TodoLog }) {
  const html = useMemo(() => {
    const raw = marked.parse(log.content) as string;
    return DOMPurify.sanitize(raw);
  }, [log.content]);

  return (
    <div className="flex gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="shrink-0 pt-0.5">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            log.source === "ai"
              ? "bg-purple-900/40 text-purple-300"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {log.source === "ai" ? "AI" : "Human"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-sm text-gray-200 prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="text-[11px] text-gray-500 mt-1">
          {formatDateTime(log.created_at)}
        </div>
      </div>
    </div>
  );
}

// --- Main ---

export function TaskDetail({ todo }: { todo: Todo }) {
  const updateTodo = useUpdateTodo();
  const { data: logsData } = useTodoLogs(todo.id);
  const addLog = useAddTodoLog();
  const [logInput, setLogInput] = useState("");

  const { data: sessionsData } = useQuery({
    queryKey: ["todos", "sessions", todo.id],
    queryFn: () => fetchTodoSessions(todo.id),
  });

  const sessions = sessionsData?.sessions ?? [];
  const logs = logsData?.logs ?? [];

  const handleGeneratePrompt = useCallback(
    () => generateTaskPrompt(todo, todo.children, sessions),
    [todo, sessions],
  );

  const handleAddLog = useCallback(() => {
    const content = logInput.trim();
    if (!content) return;
    addLog.mutate({ todoId: todo.id, content, source: "human" });
    setLogInput("");
  }, [logInput, todo.id, addLog]);

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
          <select
            value={todo.priority}
            onChange={(e) =>
              updateTodo.mutate({
                id: todo.id,
                input: { priority: e.target.value as Todo["priority"] },
              })
            }
            className="bg-[#252540] text-gray-100 text-sm rounded-md px-2 py-1 border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <InlineText
          value={todo.title}
          onSave={(v) => updateTodo.mutate({ id: todo.id, input: { title: v } })}
          className="text-xl font-bold text-gray-100"
          as="h2"
        />
        <InlineText
          value={todo.description ?? ""}
          onSave={(v) => updateTodo.mutate({ id: todo.id, input: { description: v || undefined } })}
          className="text-sm text-gray-400 whitespace-pre-wrap"
          as="p"
        />
        <div className="flex items-center gap-2">
          <LLMCopyButton generatePrompt={handleGeneratePrompt} />
        </div>
      </div>

      {/* Properties */}
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

      {/* Logs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          ログ {logs.length > 0 && <span className="text-gray-500 font-normal">({logs.length})</span>}
        </h3>

        {logs.length > 0 && (
          <div className="mb-4">
            {logs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}

        {/* Log input */}
        <div className="flex gap-2">
          <textarea
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            placeholder="ログを追加（Markdown対応）..."
            rows={2}
            className="flex-1 bg-gray-800 text-gray-100 text-sm rounded-md px-3 py-2 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAddLog();
              }
            }}
          />
          <button
            onClick={handleAddLog}
            disabled={!logInput.trim() || addLog.isPending}
            className="self-end px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-30 transition-colors"
          >
            追加
          </button>
        </div>
        <p className="text-[11px] text-gray-600 mt-1">Cmd+Enter で送信</p>
      </div>
    </div>
  );
}
