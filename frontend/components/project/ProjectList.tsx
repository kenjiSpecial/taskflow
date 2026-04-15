"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/lib/hooks/useProjects";
import type { Project } from "@/lib/types";

export function ProjectList() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useProjects();

  if (isLoading) return <div className="text-gray-400">Loading...</div>;

  const projects: Project[] = data?.projects ?? [];
  const filtered = showArchived
    ? projects
    : projects.filter((p) => !p.archived_at);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-100">プロジェクト</h1>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-purple-500"
          />
          アーカイブを表示
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-sm">プロジェクトがありません</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const activeSessionCount =
    project.session_active_count + project.session_paused_count;
  const [inserted, setInserted] = useState(false);

  function handleInsertRef(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("taskflow:insert-ref", {
        detail: { type: "project", id: project.id, title: project.name },
      }),
    );
    setInserted(true);
    setTimeout(() => setInserted(false), 1500);
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block group bg-[#252540] rounded-lg p-4 hover:bg-[#2a2a4a] transition-colors relative"
    >
      <button
        onClick={handleInsertRef}
        onMouseDown={(e) => e.stopPropagation()}
        title="チャットに参照を挿入"
        className={`absolute top-2 right-2 p-1 rounded transition-all ${inserted ? "text-purple-400" : "text-gray-500 hover:text-gray-300"}`}
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
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: project.color || "#6366f1" }}
        />
        <h2 className="text-sm font-semibold text-gray-100 truncate pr-5">
          {project.name}
        </h2>
        {project.archived_at && (
          <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            archived
          </span>
        )}
      </div>

      {project.description && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{project.todo_count} tasks</span>
        {activeSessionCount > 0 && (
          <span className="text-amber-400">
            {activeSessionCount} active session{activeSessionCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </Link>
  );
}
