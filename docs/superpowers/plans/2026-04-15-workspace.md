# Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 各タスクに1つのWorkspace（zellijセッション名 + AI起動パスログ）を持たせる。

**Architecture:** `workspaces` テーブル（todo_idにUNIQUE）と `workspace_paths` テーブルを新設。バックエンドはHonoルートを `todos.ts` にマウント。フロントエンドはTanStack Queryフック + `WorkspaceSection` コンポーネントを `TaskDetail` に追加。

**Tech Stack:** Hono, Cloudflare D1 (SQLite), Zod, Next.js App Router, TanStack Query, React

---

## ファイルマップ

| ファイル | 操作 | 内容 |
|---|---|---|
| `migrations/0013_create_workspaces.sql` | 新規作成 | workspaces/workspace_pathsテーブル |
| `src/lib/db.ts` | 修正 | WorkspaceRow, WorkspacePathRow型を追加 |
| `src/validators/workspace.ts` | 新規作成 | Zodスキーマ |
| `src/routes/workspace.ts` | 新規作成 | GET/PUT/DELETE workspace + POST/DELETE paths |
| `src/routes/todos.ts` | 修正 | workspace routerをマウント |
| `frontend/lib/types.ts` | 修正 | Workspace, WorkspacePath型を追加 |
| `frontend/lib/api.ts` | 修正 | workspace API関数を追加 |
| `frontend/lib/hooks/useWorkspace.ts` | 新規作成 | TanStack Queryフック |
| `frontend/components/task/WorkspaceSection.tsx` | 新規作成 | UIコンポーネント |
| `frontend/components/task/TaskDetail.tsx` | 修正 | WorkspaceSectionを組み込む |

---

## Task 1: DBマイグレーション

**Files:**
- Create: `migrations/0013_create_workspaces.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

```sql
-- migrations/0013_create_workspaces.sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  todo_id TEXT NOT NULL UNIQUE REFERENCES todos(id) ON DELETE CASCADE,
  zellij_session TEXT CHECK(length(zellij_session) <= 200),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT
);

CREATE UNIQUE INDEX idx_workspaces_todo_id ON workspaces(todo_id) WHERE deleted_at IS NULL;

CREATE TABLE workspace_paths (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  path TEXT NOT NULL CHECK(length(path) <= 500),
  source TEXT NOT NULL CHECK(source IN ('ai', 'human')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_workspace_paths_workspace_id ON workspace_paths(workspace_id);
```

- [ ] **Step 2: リモートD1に適用**

```bash
wrangler d1 execute taskflow-db --remote --file migrations/0013_create_workspaces.sql
```

期待出力: エラーなし

- [ ] **Step 3: d1_migrationsに手動マーク**

```bash
wrangler d1 execute taskflow-db --remote --command "INSERT INTO d1_migrations (name) VALUES ('0013_create_workspaces')"
```

- [ ] **Step 4: コミット**

```bash
git add migrations/0013_create_workspaces.sql
git commit -m "feat(db): workspacesとworkspace_pathsテーブルを追加"
```

---

## Task 2: バックエンド型定義とバリデーター

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/validators/workspace.ts`

- [ ] **Step 1: `src/lib/db.ts` にRow型を追加**

ファイル末尾（`tagExists`関数の後）に追記:

```ts
export interface WorkspaceRow {
  id: string;
  todo_id: string;
  zellij_session: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkspacePathRow {
  id: string;
  workspace_id: string;
  path: string;
  source: "ai" | "human";
  created_at: string;
}
```

- [ ] **Step 2: `src/validators/workspace.ts` を作成**

```ts
import { z } from "zod";

export const upsertWorkspaceSchema = z.object({
  zellij_session: z.string().max(200).nullable().optional(),
});

export const createWorkspacePathSchema = z.object({
  path: z.string().min(1).max(500),
  source: z.enum(["ai", "human"]),
});
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/db.ts src/validators/workspace.ts
git commit -m "feat(workspace): DB型定義とZodバリデーターを追加"
```

---

## Task 3: バックエンドルート

**Files:**
- Create: `src/routes/workspace.ts`

- [ ] **Step 1: `src/routes/workspace.ts` を作成**

```ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { WorkspaceRow, WorkspacePathRow } from "../lib/db";
import { now } from "../lib/db";
import { upsertWorkspaceSchema, createWorkspacePathSchema } from "../validators/workspace";

const app = new Hono<AppEnv>();

// GET /api/todos/:id/workspace
app.get("/", async (c) => {
  const { id } = c.req.param();

  const workspace = await c.env.DB.prepare(
    "SELECT * FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkspaceRow>();

  if (!workspace) {
    return c.json({ error: { message: "Workspace not found" } }, 404);
  }

  const paths = await c.env.DB.prepare(
    "SELECT * FROM workspace_paths WHERE workspace_id = ? ORDER BY created_at ASC",
  ).bind(workspace.id).all<WorkspacePathRow>();

  return c.json({ workspace: { ...workspace, paths: paths.results } });
});

// PUT /api/todos/:id/workspace
app.put("/", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const data = upsertWorkspaceSchema.parse(body);

  const todo = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!todo) {
    return c.json({ error: { message: "Todo not found" } }, 404);
  }

  const ts = now();
  const existing = await c.env.DB.prepare(
    "SELECT * FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkspaceRow>();

  let workspace: WorkspaceRow | null;
  if (existing) {
    workspace = await c.env.DB.prepare(
      "UPDATE workspaces SET zellij_session = ?, updated_at = ? WHERE id = ? RETURNING *",
    ).bind(data.zellij_session ?? null, ts, existing.id).first<WorkspaceRow>();
  } else {
    workspace = await c.env.DB.prepare(
      "INSERT INTO workspaces (todo_id, zellij_session, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *",
    ).bind(id, data.zellij_session ?? null, ts, ts).first<WorkspaceRow>();
  }

  const paths = await c.env.DB.prepare(
    "SELECT * FROM workspace_paths WHERE workspace_id = ? ORDER BY created_at ASC",
  ).bind(workspace!.id).all<WorkspacePathRow>();

  return c.json({ workspace: { ...workspace, paths: paths.results } });
});

// DELETE /api/todos/:id/workspace
app.delete("/", async (c) => {
  const { id } = c.req.param();
  const ts = now();

  const workspace = await c.env.DB.prepare(
    "SELECT id FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkspaceRow>();

  if (!workspace) {
    return c.json({ error: { message: "Workspace not found" } }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE workspaces SET deleted_at = ?, updated_at = ? WHERE id = ?",
  ).bind(ts, ts, workspace.id).run();

  return c.json({ success: true });
});

// POST /api/todos/:id/workspace/paths
app.post("/paths", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const data = createWorkspacePathSchema.parse(body);

  const workspace = await c.env.DB.prepare(
    "SELECT id FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkspaceRow>();

  if (!workspace) {
    return c.json({ error: { message: "Workspace not found" } }, 404);
  }

  const dup = await c.env.DB.prepare(
    "SELECT id FROM workspace_paths WHERE workspace_id = ? AND path = ?",
  ).bind(workspace.id, data.path).first();

  if (dup) {
    return c.json({ error: { message: "Path already exists" } }, 409);
  }

  const ts = now();
  const path = await c.env.DB.prepare(
    "INSERT INTO workspace_paths (workspace_id, path, source, created_at) VALUES (?, ?, ?, ?) RETURNING *",
  ).bind(workspace.id, data.path, data.source, ts).first<WorkspacePathRow>();

  return c.json({ path }, 201);
});

// DELETE /api/todos/:id/workspace/paths/:pathId
app.delete("/paths/:pathId", async (c) => {
  const { id, pathId } = c.req.param();

  const workspace = await c.env.DB.prepare(
    "SELECT id FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkspaceRow>();

  if (!workspace) {
    return c.json({ error: { message: "Workspace not found" } }, 404);
  }

  const path = await c.env.DB.prepare(
    "SELECT id FROM workspace_paths WHERE id = ? AND workspace_id = ?",
  ).bind(pathId, workspace.id).first();

  if (!path) {
    return c.json({ error: { message: "Path not found" } }, 404);
  }

  await c.env.DB.prepare(
    "DELETE FROM workspace_paths WHERE id = ?",
  ).bind(pathId).run();

  return c.json({ success: true });
});

export default app;
```

- [ ] **Step 2: コミット**

```bash
git add src/routes/workspace.ts
git commit -m "feat(workspace): Honoルートを追加（CRUD + paths）"
```

---

## Task 4: workspaceルートをtodos.tsにマウント

**Files:**
- Modify: `src/routes/todos.ts`

- [ ] **Step 1: todos.tsの先頭importに追加**

```ts
import workspace from "./workspace";
```

- [ ] **Step 2: todos.tsの末尾（`export default app;` の直前）にマウント**

```ts
// Workspace routes: /api/todos/:id/workspace
app.route("/:id/workspace", workspace);
```

- [ ] **Step 3: 動作確認**

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  https://taskflow.kenji-draemon.workers.dev/api/todos/<任意のtodo_id>/workspace
```

期待: `{"error":{"message":"Workspace not found"}}` (404) — ルートが繋がっていることを確認

- [ ] **Step 4: コミット**

```bash
git add src/routes/todos.ts
git commit -m "feat(workspace): workspaceルートをtodos.tsにマウント"
```

---

## Task 5: フロントエンド型定義

**Files:**
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: `frontend/lib/types.ts` 末尾に追加**

```ts
// --- Workspace ---

export interface WorkspacePath {
  id: string;
  workspace_id: string;
  path: string;
  source: "ai" | "human";
  created_at: string;
}

export interface Workspace {
  id: string;
  todo_id: string;
  zellij_session: string | null;
  paths: WorkspacePath[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type UpsertWorkspaceInput = {
  zellij_session?: string | null;
};

export type CreateWorkspacePathInput = {
  path: string;
  source: "ai" | "human";
};
```

- [ ] **Step 2: コミット**

```bash
git add frontend/lib/types.ts
git commit -m "feat(workspace): フロントエンド型定義を追加"
```

---

## Task 6: フロントエンドAPIクライアント

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: `frontend/lib/api.ts` のimport文に型を追加**

既存のimport文（`./types` から）に以下を追加:

```ts
  Workspace,
  UpsertWorkspaceInput,
  CreateWorkspacePathInput,
  WorkspacePath,
```

- [ ] **Step 2: `frontend/lib/api.ts` 末尾にworkspace API関数を追加**

```ts
// --- Workspace API ---

export async function fetchWorkspace(todoId: string): Promise<{ workspace: Workspace }> {
  return request(`/api/todos/${todoId}/workspace`);
}

export async function upsertWorkspace(
  todoId: string,
  input: UpsertWorkspaceInput,
): Promise<{ workspace: Workspace }> {
  return request(`/api/todos/${todoId}/workspace`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteWorkspace(todoId: string): Promise<{ success: boolean }> {
  return request(`/api/todos/${todoId}/workspace`, { method: "DELETE" });
}

export async function addWorkspacePath(
  todoId: string,
  input: CreateWorkspacePathInput,
): Promise<{ path: WorkspacePath }> {
  return request(`/api/todos/${todoId}/workspace/paths`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteWorkspacePath(
  todoId: string,
  pathId: string,
): Promise<{ success: boolean }> {
  return request(`/api/todos/${todoId}/workspace/paths/${pathId}`, {
    method: "DELETE",
  });
}
```

- [ ] **Step 3: コミット**

```bash
git add frontend/lib/api.ts
git commit -m "feat(workspace): APIクライアント関数を追加"
```

---

## Task 7: TanStack Queryフック

**Files:**
- Create: `frontend/lib/hooks/useWorkspace.ts`

- [ ] **Step 1: `frontend/lib/hooks/useWorkspace.ts` を作成**

```ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { UpsertWorkspaceInput, CreateWorkspacePathInput } from "../types";

export const workspaceKeys = {
  detail: (todoId: string) => ["workspace", todoId] as const,
};

export function useWorkspace(todoId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(todoId),
    queryFn: () => api.fetchWorkspace(todoId),
    retry: (failureCount, error) => {
      // "Workspace not found"はリトライしない（未作成は正常状態）
      // request()関数は404時に body.error.message をそのまま投げる
      if (error instanceof Error && error.message === "Workspace not found") return false;
      return failureCount < 2;
    },
  });
}

export function useUpsertWorkspace(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertWorkspaceInput) => api.upsertWorkspace(todoId, input),
    onSuccess: (data) => {
      qc.setQueryData(workspaceKeys.detail(todoId), data);
    },
  });
}

export function useDeleteWorkspace(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteWorkspace(todoId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: workspaceKeys.detail(todoId) });
    },
  });
}

export function useAddWorkspacePath(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspacePathInput) => api.addWorkspacePath(todoId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(todoId) });
    },
  });
}

export function useDeleteWorkspacePath(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pathId: string) => api.deleteWorkspacePath(todoId, pathId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(todoId) });
    },
  });
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/lib/hooks/useWorkspace.ts
git commit -m "feat(workspace): TanStack Queryフックを追加"
```

---

## Task 8: WorkspaceSectionコンポーネント

**Files:**
- Create: `frontend/components/task/WorkspaceSection.tsx`

- [ ] **Step 1: `frontend/components/task/WorkspaceSection.tsx` を作成**

```tsx
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
  const isNotFound = isError;

  if (isNotFound && !workspace) {
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
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/components/task/WorkspaceSection.tsx
git commit -m "feat(workspace): WorkspaceSectionコンポーネントを追加"
```

---

## Task 9: TaskDetailに統合

**Files:**
- Modify: `frontend/components/task/TaskDetail.tsx`

- [ ] **Step 1: TaskDetail.tsx のimportに追加**

既存importの末尾付近に追加:

```ts
import { WorkspaceSection } from "./WorkspaceSection";
```

- [ ] **Step 2: TaskDetailのreturn内、ログ一覧の直前にWorkspaceSectionを追加**

`TaskDetail` コンポーネントのJSX内で、`<div className="flex items-center gap-2">` の下（LLMCopyButtonブロック周辺）のステータス/優先度行の後、ログセクションの前に追加:

```tsx
<WorkspaceSection todoId={todo.id} />
```

- [ ] **Step 3: UIを目視確認**

1. `mprocs` またはdev serverを起動
2. 任意のタスクを開く → 「Workspaceを作成」ボタンが表示される
3. クリック → Workspaceが作成される
4. Zellijセッション名を入力して確定 → 保存される
5. 「+ パスを追加」→ パスを入力 → 追加される（👤アイコン）
6. パスにホバー → ✕ボタンが出て削除できる

- [ ] **Step 4: コミット**

```bash
git add frontend/components/task/TaskDetail.tsx
git commit -m "feat(workspace): TaskDetailにWorkspaceSectionを統合"
```

---

## Task 10: デプロイと動作確認

- [ ] **Step 1: mainにpush**

```bash
git push origin main
```

GitHub Actions CI/CDが自動デプロイ。

- [ ] **Step 2: 本番APIで確認**

```bash
# workspaceを作成
curl -X PUT \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"zellij_session":"taskflow-main"}' \
  https://taskflow.kenji-draemon.workers.dev/api/todos/<todo_id>/workspace

# パスを追加
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/Users/saito_kenji/github/taskflow","source":"ai"}' \
  https://taskflow.kenji-draemon.workers.dev/api/todos/<todo_id>/workspace/paths

# 取得
curl -H "Authorization: Bearer $API_TOKEN" \
  https://taskflow.kenji-draemon.workers.dev/api/todos/<todo_id>/workspace
```
