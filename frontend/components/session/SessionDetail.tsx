"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { StatusDot } from "@/components/common/StatusBadge";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { LLMCopyButton } from "@/components/common/LLMCopyButton";
import {
  useSessionLogs,
  useSessionTasks,
  useUpdateSession,
  useLinkSessionTask,
  useUnlinkSessionTask,
} from "@/lib/hooks/useSessions";
import { useTodos } from "@/lib/hooks/useTodos";
import { useProjects } from "@/lib/hooks/useProjects";
import { generateSessionPrompt } from "@/lib/llm-prompt";
import type { WorkSession } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  paused: "bg-amber-500/20 text-amber-400",
  done: "bg-gray-500/20 text-gray-400",
};

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("ja-JP");
}

export function SessionDetail({ session }: { session: WorkSession }) {
  const { data: logsData } = useSessionLogs(session.id);
  const { data: tasksData } = useSessionTasks(session.id);
  const { data: projectsData } = useProjects();
  const { data: todosData } = useTodos();
  const updateSession = useUpdateSession();
  const linkTask = useLinkSessionTask();
  const unlinkTask = useUnlinkSessionTask();

  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const logs = logsData?.logs ?? [];
  const linkedTasks = tasksData?.tasks ?? [];
  const projects = projectsData?.projects ?? [];
  const allTodos = todosData?.todos ?? [];

  const linkedTaskIds = new Set(linkedTasks.map((t) => t.id));
  const availableTodos = allTodos.filter((t) => !linkedTaskIds.has(t.id));

  const handleGeneratePrompt = useCallback(
    () => generateSessionPrompt(session, linkedTasks, logs),
    [session, linkedTasks, logs],
  );

  return (
    <div className="flex gap-6">
      {/* Main area */}
      <div className="flex-[2] flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-100">{session.title}</h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[session.status] ?? ""}`}
            >
              {session.status}
            </span>
          </div>
          {session.description && (
            <p className="text-sm text-gray-400 whitespace-pre-wrap">
              {session.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            <LLMCopyButton generatePrompt={handleGeneratePrompt} />
            <Link
              href={`/sessions/${session.id}/edit`}
              className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
            >
              Edit
            </Link>
          </div>
        </div>

        {/* Session Logs */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            ログ ({logs.length})
          </h3>
          {logs.length === 0 ? (
            <p className="text-xs text-gray-500">ログがありません</p>
          ) : (
            <div className="flex flex-col gap-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#252540] rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        log.source === "ai"
                          ? "bg-purple-900/40 text-purple-300"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {log.source === "ai" ? "AI" : "Human"}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">
                    {log.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Tasks */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            リンクされたタスク ({linkedTasks.length})
          </h3>
          {linkedTasks.length === 0 ? (
            <p className="text-xs text-gray-500">
              タスクがリンクされていません
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {linkedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#252540] hover:bg-[#2f2f50] transition-colors"
                >
                  <StatusDot status={task.status} />
                  <span className="text-sm text-gray-100 flex-1 truncate">
                    {task.title}
                  </span>
                  <PriorityBadge priority={task.priority} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex-1 min-w-[200px]">
        <div className="bg-[#1a1a2e] rounded-lg p-4 flex flex-col gap-6">
          {/* Project change */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">
              Project
            </label>
            <select
              value={session.project_id ?? ""}
              onChange={(e) => {
                const projectId = e.target.value || null;
                updateSession.mutate({
                  id: session.id,
                  input: { project_id: projectId },
                });
              }}
              className="w-full bg-[#252540] text-gray-100 text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Task link */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">
              タスクをリンク
            </label>
            {!showTaskPicker ? (
              <button
                onClick={() => setShowTaskPicker(true)}
                disabled={availableTodos.length === 0}
                className="w-full px-3 py-2 text-sm bg-[#252540] text-gray-300 rounded-md border border-gray-700 hover:bg-[#2f2f50] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Link Task
              </button>
            ) : (
              <select
                autoFocus
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    linkTask.mutate({
                      sessionId: session.id,
                      todoId: e.target.value,
                    });
                    setShowTaskPicker(false);
                  }
                }}
                onBlur={() => setShowTaskPicker(false)}
                className="w-full bg-[#252540] text-gray-100 text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select task...</option>
                {availableTodos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}

            {/* Linked tasks with remove */}
            {linkedTasks.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-3">
                {linkedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-[#252540] rounded text-xs"
                  >
                    <StatusDot status={task.status} />
                    <span className="text-gray-300 flex-1 truncate">
                      {task.title}
                    </span>
                    <button
                      onClick={() =>
                        unlinkTask.mutate({
                          sessionId: session.id,
                          todoId: task.id,
                        })
                      }
                      className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
                      title="Unlink task"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
