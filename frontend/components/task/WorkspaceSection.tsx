"use client";
import { useState } from "react";
import {
  useWorkspace,
  useUpsertWorkspace,
  useAddWorkspacePath,
  useDeleteWorkspacePath,
  useDeleteWorkspace,
} from "@/lib/hooks/useWorkspace";
import type { WorkspacePath } from "@/lib/types";
import { TerminalPanel } from "./TerminalPanel";

function PathIcon({ source }: { source: "ai" | "human" }) {
  return (
    <span className="text-xs" title={source === "ai" ? "AI" : "手動"}>
      {source === "ai" ? "🤖" : "👤"}
    </span>
  );
}

function ZellijEditor({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (!editing) {
    return (
      <span
        className="cursor-pointer text-sm text-gray-300 hover:text-white transition-colors"
        onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      >
        {value || <span className="text-gray-600 italic">未設定</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onSave(draft.trim() || null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { setEditing(false); onSave(draft.trim() || null); }
        if (e.key === "Escape") { setEditing(false); }
      }}
      className="text-sm text-gray-300 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 focus:outline-none focus:border-blue-500 w-48"
      placeholder="zellij session名"
    />
  );
}

function AddPathForm({ onAdd }: { onAdd: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors mt-1"
      >
        + パスを追加
      </button>
    );
  }

  return (
    <div className="flex gap-2 mt-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) { onAdd(draft.trim()); setDraft(""); setOpen(false); }
          if (e.key === "Escape") { setOpen(false); setDraft(""); }
        }}
        placeholder="/Users/..."
        className="text-xs text-gray-300 bg-gray-800 border border-gray-600 rounded px-2 py-1 flex-1 focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={() => { if (draft.trim()) { onAdd(draft.trim()); setDraft(""); setOpen(false); } }}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        追加
      </button>
      <button onClick={() => { setOpen(false); setDraft(""); }} className="text-xs text-gray-500 hover:text-gray-300">
        キャンセル
      </button>
    </div>
  );
}

export function WorkspaceSection({ todoId }: { todoId: string }) {
  const { data, isError } = useWorkspace(todoId);
  const upsert = useUpsertWorkspace(todoId);
  const addPath = useAddWorkspacePath(todoId);
  const deletePath = useDeleteWorkspacePath(todoId);
  const deleteWorkspace = useDeleteWorkspace(todoId);

  const workspace = data?.workspace;

  if (isError && !workspace) {
    return (
      <div className="mt-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Workspace</div>
        <button
          onClick={() => upsert.mutate({})}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          + Workspaceを作成
        </button>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500 uppercase tracking-wider">Workspace</div>
        <button
          onClick={() => deleteWorkspace.mutate()}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors"
        >
          削除
        </button>
      </div>

      {/* Zellij session */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 w-14">Zellij:</span>
        <ZellijEditor
          value={workspace.zellij_session}
          onSave={(v) => upsert.mutate({ zellij_session: v })}
        />
      </div>

      {/* Paths */}
      <div className="space-y-1">
        {workspace.paths.map((p: WorkspacePath) => (
          <div key={p.id} className="flex items-center gap-2 group">
            <PathIcon source={p.source} />
            <span className="text-xs text-gray-400 font-mono flex-1 truncate">{p.path}</span>
            <button
              onClick={() => deletePath.mutate(p.id)}
              className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <AddPathForm
        onAdd={(path) => addPath.mutate({ path, source: "human" })}
      />

      <TerminalPanel todoId={todoId} />
    </div>
  );
}
