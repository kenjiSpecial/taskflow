"use client";

import { useState } from "react";
import { useProjects } from "@/lib/hooks/useProjects";
import { useSessions } from "@/lib/hooks/useSessions";
import { useLinkSessionTask } from "@/lib/hooks/useSessions";
import { useTags, useLinkTodoTag } from "@/lib/hooks/useTags";
import { useUpdateTodo } from "@/lib/hooks/useTodos";
import type { Todo } from "@/lib/types";

export function TaskSidebar({ todo }: { todo: Todo }) {
  const { data: projectsData } = useProjects();
  const { data: sessionsData } = useSessions();
  const { data: tagsData } = useTags();
  const updateTodo = useUpdateTodo();
  const linkSession = useLinkSessionTask();
  const linkTag = useLinkTodoTag();

  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  const projects = projectsData?.projects ?? [];
  const sessions = sessionsData?.sessions ?? [];
  const tags = tagsData?.tags ?? [];

  const linkedTagIds = new Set((todo.tags ?? []).map((t) => t.id));
  const availableTags = tags.filter((t) => !linkedTagIds.has(t.id));

  return (
    <div className="bg-[#1a1a2e] rounded-lg p-4 flex flex-col gap-6">
      {/* Project change */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2">
          Project
        </label>
        <select
          value={todo.project_id ?? ""}
          onChange={(e) => {
            const projectId = e.target.value || null;
            updateTodo.mutate({
              id: todo.id,
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

      {/* Session link */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2">
          Sessions
        </label>
        {!showSessionPicker ? (
          <button
            onClick={() => setShowSessionPicker(true)}
            className="w-full px-3 py-2 text-sm bg-[#252540] text-gray-300 rounded-md border border-gray-700 hover:bg-[#2f2f50] transition-colors"
          >
            + Link Session
          </button>
        ) : (
          <select
            autoFocus
            value=""
            onChange={(e) => {
              if (e.target.value) {
                linkSession.mutate({
                  sessionId: e.target.value,
                  todoId: todo.id,
                });
                setShowSessionPicker(false);
              }
            }}
            onBlur={() => setShowSessionPicker(false)}
            className="w-full bg-[#252540] text-gray-100 text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.status})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tag add */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2">
          Tags
        </label>
        {(todo.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
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
        )}
        {!showTagPicker ? (
          <button
            onClick={() => setShowTagPicker(true)}
            disabled={availableTags.length === 0}
            className="w-full px-3 py-2 text-sm bg-[#252540] text-gray-300 rounded-md border border-gray-700 hover:bg-[#2f2f50] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Tag
          </button>
        ) : (
          <select
            autoFocus
            value=""
            onChange={(e) => {
              if (e.target.value) {
                linkTag.mutate({ todoId: todo.id, tagId: e.target.value });
                setShowTagPicker(false);
              }
            }}
            onBlur={() => setShowTagPicker(false)}
            className="w-full bg-[#252540] text-gray-100 text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select tag...</option>
            {availableTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
