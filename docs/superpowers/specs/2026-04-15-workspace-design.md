# Workspace機能 設計ドキュメント

**日付**: 2026-04-15  
**ステータス**: 承認済み

---

## 概要

各タスク（todo）は1つのWorkspaceを持てる。WorkspaceはローカルPCのターミナル作業環境を表し、zellijセッション名とAI起動パスのログを管理する。

---

## データモデル

### workspacesテーブル

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  todo_id TEXT NOT NULL UNIQUE REFERENCES todos(id) ON DELETE CASCADE,
  zellij_session TEXT CHECK(length(zellij_session) <= 200),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT
);

CREATE UNIQUE INDEX idx_workspaces_todo_id ON workspaces(todo_id) WHERE deleted_at IS NULL;
```

### workspace_pathsテーブル

```sql
CREATE TABLE workspace_paths (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  path TEXT NOT NULL CHECK(length(path) <= 500),
  source TEXT NOT NULL CHECK(source IN ('ai', 'human')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_workspace_paths_workspace_id ON workspace_paths(workspace_id);
```

**設計の意図:**
- `workspaces.todo_id` にUNIQUE制約でtask:workspace = 1:1を強制
- `workspace_paths.source` でAI自動記録(`ai`)とユーザー手動追加(`human`)を区別
- `workspace_paths` はimmutable（削除のみ、更新なし）
- 同一pathの重複登録はAPI層で弾く（409）
- 論理削除ルールに従い `workspaces.deleted_at` を保持（`workspace_paths` はCASCADE物理削除）

---

## API設計

### エンドポイント

```
GET    /api/todos/:id/workspace            workspace + paths一覧取得
PUT    /api/todos/:id/workspace            workspace upsert（zellij_session更新）
DELETE /api/todos/:id/workspace            workspace論理削除

POST   /api/todos/:id/workspace/paths      パス追加
DELETE /api/todos/:id/workspace/paths/:pathId  パス削除（物理）
```

### リクエスト/レスポンス

```jsonc
// PUT /api/todos/:id/workspace
{ "zellij_session": "taskflow-feat-workspace" }

// POST /api/todos/:id/workspace/paths
{ "path": "/Users/saito_kenji/github/taskflow", "source": "ai" }

// GET /api/todos/:id/workspace → 200
{
  "workspace": {
    "id": "abc123",
    "todo_id": "...",
    "zellij_session": "taskflow-feat-workspace",
    "paths": [
      { "id": "p1", "path": "/Users/saito_kenji/github/taskflow", "source": "ai", "created_at": "..." },
      { "id": "p2", "path": "/Users/saito_kenji/github/notahotel-lp-web", "source": "ai", "created_at": "..." }
    ],
    "created_at": "...",
    "updated_at": "..."
  }
}

// workspace未存在 → 404
```

### ルール

- `PUT` はworkspaceが存在しない場合は自動作成（upsert）
- workspace未設定todoへの `GET` → 404
- 同一`path`の重複 `POST` → 409
- todo存在確認はAPI層で実施（FK依存しない）

---

## フロントエンド

### TaskDetailへの組み込み

TaskDetailコンポーネントの下部にWorkspaceセクションを追加する。

```
┌─────────────────────────────────────────┐
│ [タスクタイトル]                          │
│ [description - Markdown]                 │
│                                         │
│ ── Workspace ────────────────────────── │
│ Zellij: taskflow-feat-workspace [✏]     │
│                                         │
│ Paths:                                  │
│  🤖 /Users/.../taskflow          [✕]   │
│  🤖 /Users/.../notahotel-lp-web  [✕]   │
│  👤 /Users/.../other-project     [✕]   │
│  [+ パスを追加]                          │
└─────────────────────────────────────────┘
```

- `🤖` = `source: ai`、`👤` = `source: human`
- Zellijセッション名は既存`InlineText`コンポーネントでインライン編集
- パス追加はインライン展開フォーム（テキスト入力 + 確定ボタン）
- workspace未作成時は「Workspaceを作成」ボタンを表示→クリックでupsert

### TanStack Queryフック

```ts
useWorkspace(todoId)         // GET /api/todos/:id/workspace
useUpsertWorkspace()         // PUT（zellij_session更新 or 作成）
useAddWorkspacePath()        // POST path追加
useDeleteWorkspacePath()     // DELETE path削除
```

---

## スコープ外（今回含めない）

- Claude Code hookからの自動パス記録（将来対応）
- zellijセッションへのattachコマンド生成
- workspace間のパス共有

---

## マイグレーション

`migrations/0013_create_workspaces.sql` として追加する。既存データへの影響なし。
