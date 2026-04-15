# waiting ステータス追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タスクステータスに `waiting`（外部ブロッカー待ち）を追加し、`review` と `ready_for_publish` の間に配置する

**Architecture:** DBマイグレーションで CHECK 制約を更新し、バックエンドバリデーター・フロントエンド型定義・UI コンポーネント全体に `waiting` を追加する。カンバンボードでは `review` の直後のカラムとして表示し、どのステータスからでも遷移可能。

**Tech Stack:** Cloudflare D1 (SQLite), Hono + Zod, Next.js App Router, TailwindCSS

---

## ファイルマップ

| ファイル | 変更内容 |
|---|---|
| `migrations/0012_add_waiting_status.sql` | 新規作成: CHECK 制約に `waiting` 追加 |
| `src/validators/todo.ts` | `status` enum に `waiting` 追加（3箇所） |
| `test/todos.test.ts` | `waiting` ステータスのテスト追加 |
| `frontend/lib/types.ts` | `TodoStatus` union に `waiting` 追加 |
| `frontend/components/common/StatusBadge.tsx` | `waiting` の色設定追加 |
| `frontend/components/kanban/KanbanColumn.tsx` | 3つの `Record<TodoStatus>` に `waiting` 追加 |
| `frontend/components/kanban/TaskCard.tsx` | `STATUS_BORDER_COLOR` に `waiting` 追加 |
| `frontend/components/kanban/KanbanBoard.tsx` | `COLUMNS` 配列と3つの grouped 初期値に `waiting` 追加 |
| `frontend/components/task/TaskDetail.tsx` | `STATUSES` 配列に `waiting` / `ready_for_publish` 追加 |
| `frontend/components/task/SubTaskList.tsx` | `STATUS_LABELS` に `waiting` 追加 |
| `frontend/components/project/ProjectDetail.tsx` | `STATUS_LABELS` と `STATUS_ORDER` に `waiting` 追加 |
| `frontend/lib/llm-prompt.ts` | `STATUS_LABELS` に `waiting` 追加 |

---

### Task 1: バックエンド — DBマイグレーション + バリデーター

**Files:**
- Create: `migrations/0012_add_waiting_status.sql`
- Modify: `src/validators/todo.ts`

- [ ] **Step 1: マイグレーション SQL を作成**

`migrations/0012_add_waiting_status.sql` を新規作成:

```sql
-- ステータスにwaitingを追加: backlog | todo | ready_for_code | in_progress | review | waiting | ready_for_publish | done
-- SQLiteではCHECK制約をALTERで変更できないため、テーブル再作成が必要
-- 注意: Cloudflare D1はPRAGMA foreign_keys = OFFを無視するため、FK参照を除いて再作成

PRAGMA foreign_keys = OFF;

-- 1. 新テーブルを作成（waiting追加、FK参照なし）
CREATE TABLE todos_new (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL CHECK(length(title) <= 200),
    description TEXT CHECK(length(description) <= 2000),
    status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog', 'todo', 'ready_for_code', 'in_progress', 'review', 'waiting', 'ready_for_publish', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
    due_date TEXT,
    project TEXT,
    project_id TEXT,
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at TEXT
);

-- 2. データを移行（既存データはそのまま）
INSERT INTO todos_new (id, title, description, status, priority, due_date, project, project_id, parent_id, sort_order, done_at, created_at, updated_at, deleted_at)
SELECT id, title, description, status, priority, due_date, project, project_id, parent_id, sort_order, done_at, created_at, updated_at, deleted_at
FROM todos;

-- 3. 旧テーブルを削除し、新テーブルをリネーム
DROP TABLE todos;
ALTER TABLE todos_new RENAME TO todos;

-- 4. インデックスを再作成
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_priority ON todos(priority);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_project ON todos(project);
CREATE INDEX idx_todos_parent_id ON todos(parent_id);
CREATE INDEX idx_todos_deleted_at ON todos(deleted_at);
CREATE INDEX idx_todos_project_id ON todos(project_id) WHERE deleted_at IS NULL;

PRAGMA foreign_keys = ON;
```

- [ ] **Step 2: バリデーターを更新**

`src/validators/todo.ts` の3箇所にある status enum を更新する。`"review"` の後に `"waiting"` を追加:

```typescript
import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["backlog", "todo", "ready_for_code", "in_progress", "review", "waiting", "ready_for_publish", "done"]).default("backlog"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  project: z.string().max(100).optional(),
  project_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const updateTodoSchema = createTodoSchema.partial();

export const reorderTodosSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    sort_order: z.number().int().min(0),
    parent_id: z.string().nullable().optional(),
  })).min(1).max(100),
});

export const createTodoLogSchema = z.object({
  content: z.string().min(1).max(10000),
  source: z.enum(["human", "ai"]).default("human"),
});

export const listTodoLogsQuery = z.object({
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listTodosQuery = z.object({
  status: z.enum(["backlog", "todo", "ready_for_code", "in_progress", "review", "waiting", "ready_for_publish", "done"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  project: z.string().optional(),
  project_id: z.string().optional(),
  sort: z.enum(["due_date", "priority", "created_at", "sort_order"]).default("sort_order"),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
```

- [ ] **Step 3: テストを追加**

`test/todos.test.ts` の既存テスト（`"TODO更新（review）"` の後）に以下を追加:

```typescript
  it("TODO更新（waiting）", async () => {
    const createRes = await createTodo({ title: "waitingステータステスト" });
    const created = await createRes.json() as { todo: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "waiting" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { todo: { status: string } };
    expect(data.todo.status).toBe("waiting");
  });
```

- [ ] **Step 4: テスト実行（失敗確認）**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "waiting|FAIL|PASS"
```

期待: `waiting` テストが FAIL（まだマイグレーション未適用のため）

- [ ] **Step 5: ローカルDBにマイグレーション適用**

```bash
npx wrangler d1 migrations apply taskflow-db --local
```

期待: `0012_add_waiting_status.sql` が適用される

- [ ] **Step 6: テスト再実行（全通過確認）**

```bash
npm test
```

期待: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add migrations/0012_add_waiting_status.sql src/validators/todo.ts test/todos.test.ts
git commit -m "feat(todos): waitingステータスをDBとバリデーターに追加"
```

---

### Task 2: フロントエンド — 型定義と共通コンポーネント

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/components/common/StatusBadge.tsx`

- [ ] **Step 1: `TodoStatus` 型を更新**

`frontend/lib/types.ts` の42行目を変更:

```typescript
export type TodoStatus = "backlog" | "todo" | "ready_for_code" | "in_progress" | "review" | "waiting" | "ready_for_publish" | "done";
```

- [ ] **Step 2: StatusBadge に `waiting` を追加**

`frontend/components/common/StatusBadge.tsx` の `STATUS_CONFIG` に追加（`review` の後）:

```typescript
const STATUS_CONFIG: Record<
  TodoStatus,
  { label: string; color: string; dotColor: string }
> = {
  backlog: { label: "Backlog", color: "text-gray-400", dotColor: "bg-gray-400" },
  todo: { label: "Todo", color: "text-blue-400", dotColor: "bg-blue-400" },
  ready_for_code: {
    label: "Ready for Code",
    color: "text-cyan-400",
    dotColor: "bg-cyan-400",
  },
  in_progress: {
    label: "In Progress",
    color: "text-amber-400",
    dotColor: "bg-amber-400",
  },
  review: {
    label: "Review",
    color: "text-purple-400",
    dotColor: "bg-purple-400",
  },
  waiting: {
    label: "Waiting",
    color: "text-yellow-400",
    dotColor: "bg-yellow-400",
  },
  ready_for_publish: {
    label: "Pending Publish",
    color: "text-orange-400",
    dotColor: "bg-orange-400",
  },
  done: { label: "Done", color: "text-green-400", dotColor: "bg-green-400" },
};
```

- [ ] **Step 3: TypeScript 型チェック**

```bash
cd frontend && npm run typecheck 2>&1 | head -30
```

期待: エラーなし（`Record<TodoStatus>` を使っている箇所は型エラーが出るが、Task 3 で解消する）

- [ ] **Step 4: コミット**

```bash
git add frontend/lib/types.ts frontend/components/common/StatusBadge.tsx
git commit -m "feat(frontend): TodoStatus型とStatusBadgeにwaitingを追加"
```

---

### Task 3: フロントエンド — カンバンコンポーネント

**Files:**
- Modify: `frontend/components/kanban/KanbanColumn.tsx`
- Modify: `frontend/components/kanban/TaskCard.tsx`
- Modify: `frontend/components/kanban/KanbanBoard.tsx`

- [ ] **Step 1: `KanbanColumn.tsx` を更新**

3つの `Record<TodoStatus>` に `waiting` を追加（各 `review` の後）:

```typescript
const STATUS_LABEL: Record<TodoStatus, string> = {
  backlog: "BACKLOG",
  todo: "TODO",
  ready_for_code: "READY FOR CODE",
  in_progress: "IN PROGRESS",
  review: "REVIEW",
  waiting: "WAITING",
  ready_for_publish: "PENDING PUBLISH",
  done: "DONE",
};

const STATUS_BADGE_COLOR: Record<TodoStatus, string> = {
  backlog: "bg-gray-600 text-gray-300",
  todo: "bg-blue-900 text-blue-300",
  ready_for_code: "bg-cyan-900 text-cyan-300",
  in_progress: "bg-amber-900 text-amber-300",
  review: "bg-purple-900 text-purple-300",
  waiting: "bg-yellow-900 text-yellow-300",
  ready_for_publish: "bg-orange-900 text-orange-300",
  done: "bg-green-900 text-green-300",
};

const STATUS_HIGHLIGHT: Record<TodoStatus, string> = {
  backlog: "ring-gray-400/50 bg-gray-800/30",
  todo: "ring-blue-400/50 bg-blue-900/20",
  ready_for_code: "ring-cyan-400/50 bg-cyan-900/20",
  in_progress: "ring-amber-400/50 bg-amber-900/20",
  review: "ring-purple-400/50 bg-purple-900/20",
  waiting: "ring-yellow-400/50 bg-yellow-900/20",
  ready_for_publish: "ring-orange-400/50 bg-orange-900/20",
  done: "ring-green-400/50 bg-green-900/20",
};
```

- [ ] **Step 2: `TaskCard.tsx` を更新**

`STATUS_BORDER_COLOR` に `waiting` を追加（`review` の後）:

```typescript
const STATUS_BORDER_COLOR: Record<TodoStatus, string> = {
  backlog: "border-l-gray-400",
  todo: "border-l-blue-400",
  ready_for_code: "border-l-cyan-400",
  in_progress: "border-l-amber-400",
  review: "border-l-purple-400",
  waiting: "border-l-yellow-400",
  ready_for_publish: "border-l-orange-400",
  done: "border-l-green-400",
};
```

- [ ] **Step 3: `KanbanBoard.tsx` を更新**

**3-a. `COLUMNS` 配列に `waiting` を追加**（`"review"` の後）:

```typescript
const COLUMNS: TodoStatus[] = [
  "backlog",
  "todo",
  "ready_for_code",
  "in_progress",
  "review",
  "waiting",
  "ready_for_publish",
  "done",
];
```

**3-b. `groupByProject` 内の `grouped` 初期値（57行目付近）**:

```typescript
const grouped: Record<TodoStatus, Todo[]> = {
  backlog: [],
  todo: [],
  ready_for_code: [],
  in_progress: [],
  review: [],
  waiting: [],
  ready_for_publish: [],
  done: [],
};
```

**3-c. `groupByProject` 内の `noProject` 初期値（80行目付近）**:

```typescript
const noProject: Record<TodoStatus, Todo[]> = {
  backlog: [],
  todo: [],
  ready_for_code: [],
  in_progress: [],
  review: [],
  waiting: [],
  ready_for_publish: [],
  done: [],
};
```

**3-d. `grouped` useMemo 内の `map` 初期値（202行目付近）**:

```typescript
const map: Record<TodoStatus, Todo[]> = {
  backlog: [],
  todo: [],
  ready_for_code: [],
  in_progress: [],
  review: [],
  waiting: [],
  ready_for_publish: [],
  done: [],
};
```

- [ ] **Step 4: TypeScript 型チェック**

```bash
cd frontend && npm run typecheck 2>&1 | head -30
```

期待: エラーなし

- [ ] **Step 5: コミット**

```bash
git add frontend/components/kanban/KanbanColumn.tsx frontend/components/kanban/TaskCard.tsx frontend/components/kanban/KanbanBoard.tsx
git commit -m "feat(kanban): waitingステータスのカラム・カード表示を追加"
```

---

### Task 4: フロントエンド — タスク詳細・プロジェクトビュー・LLMプロンプト

**Files:**
- Modify: `frontend/components/task/TaskDetail.tsx`
- Modify: `frontend/components/task/SubTaskList.tsx`
- Modify: `frontend/components/project/ProjectDetail.tsx`
- Modify: `frontend/lib/llm-prompt.ts`

- [ ] **Step 1: `TaskDetail.tsx` の `STATUSES` 配列を更新**

19〜26行目の `STATUSES` を更新（`waiting` と `ready_for_publish` を追加）:

```typescript
const STATUSES: { value: TodoStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "ready_for_code", label: "Ready for Code" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "waiting", label: "Waiting" },
  { value: "ready_for_publish", label: "Pending Publish" },
  { value: "done", label: "Done" },
];
```

- [ ] **Step 2: `SubTaskList.tsx` の `STATUS_LABELS` を更新**

```typescript
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
```

- [ ] **Step 3: `ProjectDetail.tsx` の `STATUS_LABELS` と `STATUS_ORDER` を更新**

`STATUS_LABELS`（22〜30行目）:

```typescript
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
```

`STATUS_ORDER`（14〜20行目）の `waiting` を `review` の後に追加:

```typescript
const STATUS_ORDER: TodoStatus[] = [
  "in_progress",
  "review",
  "waiting",
  "todo",
  "backlog",
  "done",
];
```

- [ ] **Step 4: `llm-prompt.ts` の `STATUS_LABELS` を更新**

3〜12行目:

```typescript
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  waiting: "Waiting",
  ready_for_publish: "Pending Publish",
  done: "Done",
  active: "Active",
  paused: "Paused",
};
```

- [ ] **Step 5: TypeScript 型チェック（全クリア確認）**

```bash
cd frontend && npm run typecheck 2>&1 | head -30
```

期待: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/components/task/TaskDetail.tsx frontend/components/task/SubTaskList.tsx frontend/components/project/ProjectDetail.tsx frontend/lib/llm-prompt.ts
git commit -m "feat(frontend): タスク詳細・プロジェクトビューにwaitingステータスを追加"
```

---

### Task 5: 本番DBマイグレーション適用

**Files:** なし（コマンドのみ）

- [ ] **Step 1: 本番 D1 にマイグレーション適用**

```bash
npx wrangler d1 migrations apply taskflow-db --remote
```

期待: `0012_add_waiting_status.sql` が本番 DB に適用される

- [ ] **Step 2: デプロイ（バックエンド）**

```bash
npx wrangler deploy
```

- [ ] **Step 3: フロントエンドデプロイ**

```bash
cd frontend && npm run deploy
```

- [ ] **Step 4: 動作確認**

ブラウザで `https://taskflow.kenji-draemon.workers.dev`（フロントエンド URL）を開き、カンバンボードに `WAITING` カラムが `REVIEW` の右に表示されることを確認する。タスクカードをドラッグして `WAITING` カラムにドロップできることを確認する。

