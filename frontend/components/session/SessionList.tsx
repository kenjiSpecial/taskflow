"use client";

import { useState } from "react";
import Link from "next/link";
import { useSessions } from "@/lib/hooks/useSessions";
import type { WorkSession } from "@/lib/types";

type StatusFilter = "all" | "active" | "paused" | "done";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  paused: "bg-amber-500/20 text-amber-400",
  done: "bg-gray-500/20 text-gray-400",
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("ja-JP");
}

export function SessionList() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const { data, isLoading } = useSessions();

  if (isLoading) return <div className="text-gray-400">Loading...</div>;

  const sessions: WorkSession[] = data?.sessions ?? [];
  const filtered =
    filter === "all"
      ? sessions
      : sessions.filter((s) => s.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-100">セッション</h1>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filter === f.value
                  ? "bg-purple-600 text-white"
                  : "bg-[#252540] text-gray-400 hover:bg-[#2f2f50]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-sm">セッションがありません</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: WorkSession }) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      className="flex items-center gap-4 bg-[#252540] rounded-lg px-4 py-3 hover:bg-[#2a2a4a] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-100 truncate">
            {session.title}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[session.status] ?? ""}`}
          >
            {session.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {session.project && <span>{session.project}</span>}
          <span>
            {session.task_completed}/{session.task_total} tasks
          </span>
          <span>{formatDate(session.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
