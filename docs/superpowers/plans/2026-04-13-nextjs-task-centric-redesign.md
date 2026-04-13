# Next.js移行 + タスク中心リデザイン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フロントエンドをPreact SPAからNext.js App Routerに移行し、タスク中心のカンバンUIに再設計する

**Architecture:** バックエンド（Hono + D1 Workers）は維持。フロントエンドを `frontend/` 内でNext.jsプロジェクトとしてフルリビルド。データフェッチはTanStack Query、Realtime同期は既存WebSocket基盤をそのまま利用。`@opennextjs/cloudflare` でCloudflare Workersにデプロイ（`@cloudflare/next-on-pages` は非推奨のため）。

**Tech Stack:** Next.js 16 (App Router), React 19.2+, TanStack Query v5, Tailwind CSS v4, @opennextjs/cloudflare, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-13-nextjs-task-centric-redesign.md`

---

## ファイル構成

### 新規作成（frontend/）

```
frontend/
  app/
    layout.tsx              # ルートレイアウト（Providers, ChatPanel）
    page.tsx                # / → カンバンボード
    tasks/[id]/page.tsx     # タスク詳細
    projects/page.tsx       # プロジェクト一覧
    projects/[id]/page.tsx  # プロジェクト詳細
    sessions/page.tsx       # セッション一覧
    sessions/[id]/page.tsx  # セッション詳細
    providers.tsx           # QueryClientProvider
  components/
    kanban/
      KanbanBoard.tsx       # カンバンボード全体
      KanbanColumn.tsx      # 1カラム（ステータスごと）
      TaskCard.tsx          # カンバン内タスクカード
    task/
      TaskDetail.tsx        # タスク詳細メインエリア
      TaskSidebar.tsx       # タスク詳細サイドバー（紐づけ操作）
      SubTaskList.tsx       # サブタスク一覧
    project/
      ProjectList.tsx       # プロジェクト一覧
      ProjectDetail.tsx     # プロジェクト詳細
      ProjectStats.tsx      # 統計カード
    session/
      SessionList.tsx       # セッション一覧
      SessionDetail.tsx     # セッション詳細
    chat/
      ChatPanel.tsx         # チャットサイドバー
      ChatToggleButton.tsx  # トグルボタン
      MessageBubble.tsx     # メッセージ表示
      ConfirmDialog.tsx     # 破壊操作確認
    common/
      LLMCopyButton.tsx     # LLMプロンプトコピーボタン
      StatusBadge.tsx       # ステータスバッジ
      PriorityBadge.tsx     # 優先度バッジ
  lib/
    api.ts                  # APIクライアント（既存移植）
    types.ts                # 型定義
    hooks/
      useTodos.ts           # TanStack Query hooks for todos
      useProjects.ts        # TanStack Query hooks for projects
      useSessions.ts        # TanStack Query hooks for sessions
      useTags.ts            # TanStack Query hooks for tags
    realtime.ts             # WebSocket接続・TanStack Query invalidation
    llm-prompt.ts           # LLMプロンプト生成ロジック
    client-id.ts            # クライアントID管理（既存移植）
  open-next.config.ts       # OpenNext設定
  wrangler.jsonc            # フロントエンド用Wrangler設定
  next.config.ts            # Next.js設定
  package.json
  tsconfig.json
  tailwind.config.ts
  .env.local                # ローカル環境変数
```

### 変更対象（バックエンド）

```
migrations/0008_update_todo_status.sql    # ステータス変更 + カラムリネーム
src/validators/todo.ts                     # ステータスenum更新
src/routes/todos.ts                        # completed_at → done_at
src/lib/db.ts                              # completed_at → done_at（参照箇所あれば）
src/types.ts                               # 型更新
test/todos.test.ts                         # テスト更新
test/helpers.ts                            # テストヘルパー更新
agent-tools.ts                             # ステータスenum更新
macos-menubar/TaskFlowBar/Models/Todo.swift # completedAt → doneAt
```

---

## Task 1: バックエンド — ステータスマイグレーション

**Files:**
- Create: `migrations/0008_update_todo_status.sql`
- Modify: `src/validators/todo.ts`
- Modify: `src/routes/todos.ts`
- Modify: `src/types.ts`
- Modify: `test/todos.test.ts`
- Modify: `test/helpers.ts`
- Modify: `agent-tools.ts`
- Modify: `macos-menubar/TaskFlowBar/Models/Todo.swift`

- [ ] **Step 1: マイグレーションSQLを作成**

```sql
-- migrations/0008_update_todo_status.sql

-- ステータス値を新しい値に変換
UPDATE todos SET status = 'backlog' WHERE status = 'pending';
UPDATE todos SET status = 'done' WHERE status = 'completed';
-- in_progress はそのまま

-- completed_at → done_at リネーム
ALTER TABLE todos RENAME COLUMN completed_at TO done_at;
```

- [ ] **Step 2: Zodバリデーターを更新**

`src/validators/todo.ts` の status enum を更新:
```typescript
// 旧: z.enum(["pending", "in_progress", "completed"])
// 新:
z.enum(["backlog", "todo", "in_progress", "review", "done"])
```

createTodoSchemaのdefaultも更新:
```typescript
// 旧: .default("pending")
// 新:
.default("backlog")
```

- [ ] **Step 3: routes/todos.tsのcompleted_at参照を更新**

`src/routes/todos.ts` 内の `completed_at` を `done_at` に一括置換。ステータス `completed` → `done` のチェック箇所も更新。

- [ ] **Step 4: types.tsを更新**

`src/types.ts` のTodo型のstatus定義を更新。

- [ ] **Step 5: agent-tools.tsを更新**

`agent-tools.ts` 内のステータスenum記述（12行目・52行目付近）を `backlog | todo | in_progress | review | done` に更新。

- [ ] **Step 6: macOS menubarのSwiftコードを更新**

`macos-menubar/TaskFlowBar/Models/Todo.swift`:
- `completedAt` → `doneAt` にリネーム
- CodingKeys: `completed_at` → `done_at`
- `isCompleted` の比較を `status == "done"` に変更

- [ ] **Step 7: テストを更新**

`test/todos.test.ts` と `test/helpers.ts`:
- `completed_at` → `done_at` に置換
- `pending` → `backlog`、`completed` → `done` に置換
- 新ステータス `todo`, `review` のテストケースを追加

- [ ] **Step 8: テスト実行**

```bash
npm test
```

Expected: 全テストPASS

- [ ] **Step 9: 型チェック**

```bash
npm run typecheck
```

Expected: エラーなし

- [ ] **Step 10: コミット**

```bash
git add migrations/ src/ test/ agent-tools.ts macos-menubar/
git commit -m "feat(api): タスクステータスを5段階カンバンフローに拡張"
```

---

## Task 2: Next.jsプロジェクトセットアップ

**Files:**
- Create: `frontend/package.json`, `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.ts`, `frontend/open-next.config.ts`, `frontend/wrangler.jsonc`, `frontend/app/layout.tsx`, `frontend/app/providers.tsx`

- [ ] **Step 1: 既存frontendをバックアップ・クリーン**

```bash
mv frontend frontend-preact-backup
```

- [ ] **Step 2: Next.jsプロジェクト作成**

```bash
npx create-next-app@latest frontend \
  --typescript --tailwind --app --src-dir=false \
  --import-alias="@/*" --use-npm
```

- [ ] **Step 3: OpenNext + 依存パッケージをインストール**

```bash
cd frontend
npm install @opennextjs/cloudflare@latest
npm install --save-dev wrangler@latest
npm install @tanstack/react-query@5
npm install marked dompurify
npm install --save-dev @types/dompurify
```

- [ ] **Step 4: next.config.ts設定**

```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 5: open-next.config.ts作成**

```typescript
// frontend/open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
```

- [ ] **Step 6: frontend/wrangler.jsonc作成**

```jsonc
// frontend/wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "taskflow-frontend",
  "compatibility_date": "2025-05-06",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

- [ ] **Step 7: package.jsonにスクリプト追加**

```json
{
  "scripts": {
    "dev": "next dev --port 5173",
    "build": "next build",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
  }
}
```

- [ ] **Step 8: .env.local作成**

```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_API_TOKEN=（.dev.varsのAPI_TOKEN値をコピー）
```

- [ ] **Step 9: Providers作成**

```tsx
// frontend/app/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000 },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **Step 10: ルートレイアウト作成**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "タスク・スケジュール管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 11: 仮トップページで動作確認**

```tsx
// frontend/app/page.tsx
export default function Home() {
  return <h1>TaskFlow</h1>;
}
```

- [ ] **Step 12: dev起動確認**

```bash
cd frontend && npm run dev
```

ブラウザで http://localhost:5173 を開き「TaskFlow」が表示されることを確認。

- [ ] **Step 13: .gitignoreに追加**

```
.open-next
```

- [ ] **Step 14: コミット**

```bash
git add frontend/ .gitignore
git commit -m "feat(frontend): Next.jsプロジェクトを初期セットアップ"
```

---

## Task 3: APIクライアント・型定義の移植

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/client-id.ts`

- [ ] **Step 1: 型定義を作成**

`frontend/lib/types.ts` — 既存 `frontend-preact-backup/src/lib/api.ts` から型定義を抽出。

statusを新ステータスに更新:
```typescript
export type TodoStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
```

`completed_at` → `done_at` に変更:
```typescript
export interface Todo {
  // ...
  done_at: string | null;  // 旧: completed_at
  // ...
}
```

- [ ] **Step 2: client-id.tsを移植**

`frontend-preact-backup/src/lib/client-id.ts` をそのまま `frontend/lib/client-id.ts` にコピー。

- [ ] **Step 3: APIクライアントを移植**

`frontend-preact-backup/src/lib/api.ts` を `frontend/lib/api.ts` に移植。変更点:
- 型はすべて `types.ts` からimport
- 環境変数: `VITE_API_URL` → `process.env.NEXT_PUBLIC_API_URL`
- 環境変数: `VITE_API_TOKEN` → `process.env.NEXT_PUBLIC_API_TOKEN`
- `completed_at` → `done_at` の参照更新

- [ ] **Step 4: 型チェック**

```bash
cd frontend && npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add frontend/lib/
git commit -m "feat(frontend): APIクライアント・型定義を移植"
```

---

## Task 4: TanStack Queryフック

**Files:**
- Create: `frontend/lib/hooks/useTodos.ts`
- Create: `frontend/lib/hooks/useProjects.ts`
- Create: `frontend/lib/hooks/useSessions.ts`
- Create: `frontend/lib/hooks/useTags.ts`

- [ ] **Step 1: useTodos.tsを作成**

```typescript
// frontend/lib/hooks/useTodos.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { CreateTodoInput, UpdateTodoInput } from "../types";

export const todoKeys = {
  all: ["todos"] as const,
  list: (params?: api.TodoListParams) => [...todoKeys.all, "list", params] as const,
  detail: (id: string) => [...todoKeys.all, "detail", id] as const,
};

export function useTodos(params?: api.TodoListParams) {
  return useQuery({
    queryKey: todoKeys.list(params),
    queryFn: () => api.fetchTodos(params),
  });
}

export function useTodo(id: string) {
  return useQuery({
    queryKey: todoKeys.detail(id),
    queryFn: () => api.fetchTodo(id),
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoInput) => api.createTodo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTodoInput }) =>
      api.updateTodo(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTodo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
```

- [ ] **Step 2: useProjects.tsを作成**

同パターンで `projectKeys`, `useProjects`, `useProject`, `useCreateProject`, `useUpdateProject`, `useDeleteProject` を実装。

- [ ] **Step 3: useSessions.tsを作成**

同パターンで `sessionKeys`, `useSessions`, `useSession`, session logs/tasks関連のhooksを実装。

- [ ] **Step 4: useTags.tsを作成**

同パターンで `tagKeys`, `useTags`, tag CRUD + リンク操作hooksを実装。

- [ ] **Step 5: 型チェック**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: コミット**

```bash
git add frontend/lib/hooks/
git commit -m "feat(frontend): TanStack Queryフックを実装"
```

---

## Task 5: Realtime同期（WebSocket + TanStack Query invalidation）

**Files:**
- Create: `frontend/lib/realtime.ts`

- [ ] **Step 1: realtime.tsを作成**

既存 `frontend-preact-backup/src/stores/realtime-store.ts` のロジックを移植。変更点:
- Preact signals → React state不要（QueryClient invalidationのみ行う）
- `connectRealtime(queryClient: QueryClient)` として、QueryClientを受け取る
- WSイベント受信時に該当queryKeyをinvalidate:
  - `projects` → `projectKeys.all`
  - `todos` → `todoKeys.all`
  - `sessions` → `sessionKeys.all`
  - `tags` → `tagKeys.all`
  - `session_logs` / `session_tasks` → `sessionKeys.all`
- 環境変数: `VITE_API_URL` → `process.env.NEXT_PUBLIC_API_URL`
- 環境変数: `VITE_API_TOKEN` → `process.env.NEXT_PUBLIC_API_TOKEN`
- 再接続ロジック（exponential backoff）はそのまま移植

```typescript
// frontend/lib/realtime.ts
import type { QueryClient } from "@tanstack/react-query";
import { todoKeys } from "./hooks/useTodos";
import { projectKeys } from "./hooks/useProjects";
import { sessionKeys } from "./hooks/useSessions";
import { tagKeys } from "./hooks/useTags";
import { getClientId } from "./client-id";

type RealtimeResource = "projects" | "todos" | "sessions" | "tags" | "session_logs" | "session_tasks";

const RESOURCE_KEY_MAP: Record<RealtimeResource, readonly string[]> = {
  projects: projectKeys.all,
  todos: todoKeys.all,
  sessions: sessionKeys.all,
  tags: tagKeys.all,
  session_logs: sessionKeys.all,
  session_tasks: sessionKeys.all,
};

export function connectRealtime(queryClient: QueryClient): () => void {
  // WS接続、イベント処理、再接続ロジックを実装
  // return cleanup function
}
```

- [ ] **Step 2: Providers内でRealtime接続を初期化**

`frontend/app/providers.tsx` に `useEffect` でRealtime接続を追加:

```typescript
useEffect(() => {
  const cleanup = connectRealtime(queryClient);
  return cleanup;
}, [queryClient]);
```

- [ ] **Step 3: dev起動してWSコンソール確認**

```bash
npm run dev  # backend
cd frontend && npm run dev  # frontend
```

ブラウザのDevToolsで WebSocket接続が確立されることを確認。

- [ ] **Step 4: コミット**

```bash
git add frontend/lib/realtime.ts frontend/app/providers.tsx
git commit -m "feat(frontend): WebSocket Realtime同期をTanStack Query連携で実装"
```

---

## Task 6: 共通コンポーネント

**Files:**
- Create: `frontend/components/common/LLMCopyButton.tsx`
- Create: `frontend/components/common/StatusBadge.tsx`
- Create: `frontend/components/common/PriorityBadge.tsx`
- Create: `frontend/lib/llm-prompt.ts`

- [ ] **Step 1: ステータス・優先度バッジを作成**

```tsx
// frontend/components/common/StatusBadge.tsx
"use client";
import type { TodoStatus } from "@/lib/types";

const STATUS_CONFIG: Record<TodoStatus, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "text-gray-400" },
  todo: { label: "Todo", color: "text-blue-400" },
  in_progress: { label: "In Progress", color: "text-amber-400" },
  review: { label: "Review", color: "text-purple-400" },
  done: { label: "Done", color: "text-green-400" },
};

export function StatusBadge({ status }: { status: TodoStatus }) {
  const config = STATUS_CONFIG[status];
  return <span className={config.color}>{config.label}</span>;
}
```

PriorityBadgeも同様に作成。

- [ ] **Step 2: LLMプロンプト生成ロジックを作成**

`frontend/lib/llm-prompt.ts` — spec記載のMarkdownテンプレートを実装:
- `generateTaskPrompt(todo, children, sessions)` → Markdown文字列
- `generateProjectPrompt(project, todos, sessions)` → Markdown文字列
- `generateSessionPrompt(session, tasks, logs)` → Markdown文字列

- [ ] **Step 3: LLMCopyButtonを作成**

```tsx
// frontend/components/common/LLMCopyButton.tsx
"use client";
import { useState, useCallback } from "react";

interface Props {
  generatePrompt: () => string;
}

export function LLMCopyButton({ generatePrompt }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = generatePrompt();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatePrompt]);

  return (
    <button onClick={handleCopy} className="...">
      {copied ? "コピー済み" : "LLMプロンプトをコピー"}
    </button>
  );
}
```

- [ ] **Step 4: コミット**

```bash
git add frontend/components/common/ frontend/lib/llm-prompt.ts
git commit -m "feat(frontend): 共通コンポーネント（Badge, LLMCopyButton）を実装"
```

---

## Task 7: カンバンボード（トップページ）

**Files:**
- Create: `frontend/components/kanban/KanbanBoard.tsx`
- Create: `frontend/components/kanban/KanbanColumn.tsx`
- Create: `frontend/components/kanban/TaskCard.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: TaskCardコンポーネントを作成**

```tsx
// frontend/components/kanban/TaskCard.tsx
"use client";
import Link from "next/link";
import type { Todo } from "@/lib/types";

export function TaskCard({ todo }: { todo: Todo }) {
  return (
    <Link href={`/tasks/${todo.id}`} className="block bg-[#252540] rounded-md p-3 border-l-3 ...">
      <div className="text-sm font-medium">{todo.title}</div>
      {todo.project_id && (
        <div className="text-xs text-gray-500 mt-1">{/* project name */}</div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: KanbanColumnコンポーネントを作成**

```tsx
// frontend/components/kanban/KanbanColumn.tsx
"use client";
import type { Todo, TodoStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";

interface Props {
  status: TodoStatus;
  todos: Todo[];
  onDrop: (todoId: string, newStatus: TodoStatus) => void;
}

export function KanbanColumn({ status, todos, onDrop }: Props) {
  // ドラッグ&ドロップ: HTML Drag and Drop APIを使用
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    const todoId = e.dataTransfer.getData("todoId");
    onDrop(todoId, status);
  };

  return (
    <div className="min-w-[220px] flex-1 bg-[#1a1a2e] rounded-lg p-3"
         onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="font-semibold text-sm mb-2 uppercase">
        {status} <span className="...">{todos.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {todos.map((todo) => (
          <TaskCard key={todo.id} todo={todo} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: KanbanBoardコンポーネントを作成**

```tsx
// frontend/components/kanban/KanbanBoard.tsx
"use client";
import { useTodos, useUpdateTodo } from "@/lib/hooks/useTodos";
import { KanbanColumn } from "./KanbanColumn";
import type { TodoStatus } from "@/lib/types";

const COLUMNS: TodoStatus[] = ["backlog", "todo", "in_progress", "review", "done"];

export function KanbanBoard() {
  const { data } = useTodos();
  const updateTodo = useUpdateTodo();

  const todos = data?.data ?? [];
  const grouped = COLUMNS.reduce((acc, status) => {
    acc[status] = todos.filter((t) => t.status === status);
    return acc;
  }, {} as Record<TodoStatus, typeof todos>);

  const handleDrop = (todoId: string, newStatus: TodoStatus) => {
    updateTodo.mutate({ id: todoId, input: { status: newStatus } });
  };

  return (
    <div className="flex gap-3 overflow-x-auto min-h-[calc(100vh-80px)] p-4">
      {COLUMNS.map((status) => (
        <KanbanColumn key={status} status={status} todos={grouped[status]} onDrop={handleDrop} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: トップページに組み込み**

```tsx
// frontend/app/page.tsx
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default function Home() {
  return <KanbanBoard />;
}
```

- [ ] **Step 5: ブラウザで動作確認**

バックエンドを起動し、`cd frontend && npm run dev` で確認。カンバンボードにタスクが表示され、D&Dでステータス変更できることを確認。

- [ ] **Step 6: コミット**

```bash
git add frontend/components/kanban/ frontend/app/page.tsx
git commit -m "feat(frontend): カンバンボード（トップページ）を実装"
```

---

## Task 8: タスク詳細ページ

**Files:**
- Create: `frontend/components/task/TaskDetail.tsx`
- Create: `frontend/components/task/TaskSidebar.tsx`
- Create: `frontend/components/task/SubTaskList.tsx`
- Create: `frontend/app/tasks/[id]/page.tsx`

- [ ] **Step 1: SubTaskList作成**

サブタスク一覧。ステータスドット + タイトル + ステータスラベル。各サブタスクは `/tasks/[id]` へのリンク。

- [ ] **Step 2: TaskSidebar作成**

紐づけ操作サイドバー:
- プロジェクト変更（select）: `useProjects` で選択肢取得、`useUpdateTodo` で変更
- セッションリンク追加: `useSessions` で一覧取得、API `linkTaskToSession` を呼び出し
- タグ追加: `useTags` で一覧取得、API `linkTodoTag` を呼び出し

- [ ] **Step 3: TaskDetail作成**

メインエリア:
- ヘッダー: タイトル、ステータスセレクタ、LLMCopyButton、編集ボタン
- プロパティグリッド（2列）: プロジェクト（リンク）、優先度、期日、タグ
- SubTaskList
- セッション一覧: `useTodo` の結果からリンクセッション表示

- [ ] **Step 4: ページコンポーネント作成**

```tsx
// frontend/app/tasks/[id]/page.tsx
"use client";
import { use } from "react";
import { TaskDetail } from "@/components/task/TaskDetail";
import { TaskSidebar } from "@/components/task/TaskSidebar";
import { useTodo } from "@/lib/hooks/useTodos";

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: todo, isLoading } = useTodo(id);

  if (isLoading) return <div>Loading...</div>;
  if (!todo) return <div>Not found</div>;

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-[2]">
        <TaskDetail todo={todo} />
      </div>
      <div className="flex-1 min-w-[200px]">
        <TaskSidebar todo={todo} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: ブラウザで動作確認**

カンバンのカードをクリック → タスク詳細ページへ遷移。プロパティ表示、サブタスク、セッション一覧、紐づけ操作を確認。

- [ ] **Step 6: コミット**

```bash
git add frontend/components/task/ frontend/app/tasks/
git commit -m "feat(frontend): タスク詳細ページを実装"
```

---

## Task 9: プロジェクトページ（一覧 + 詳細）

**Files:**
- Create: `frontend/components/project/ProjectList.tsx`
- Create: `frontend/components/project/ProjectDetail.tsx`
- Create: `frontend/components/project/ProjectStats.tsx`
- Create: `frontend/app/projects/page.tsx`
- Create: `frontend/app/projects/[id]/page.tsx`

- [ ] **Step 1: ProjectList作成**

プロジェクトカード一覧。各カードにプロジェクト名、色ドット、タスク数、アクティブセッション数を表示。クリックで `/projects/[id]` に遷移。

- [ ] **Step 2: プロジェクト一覧ページ作成**

```tsx
// frontend/app/projects/page.tsx
import { ProjectList } from "@/components/project/ProjectList";
export default function ProjectsPage() {
  return <ProjectList />;
}
```

- [ ] **Step 3: ProjectStats作成**

統計カード4つ: タスク合計、進行中、完了、セッション数。

- [ ] **Step 4: ProjectDetail作成**

- ヘッダー: プロジェクト名、説明、LLMCopyButton、編集
- ProjectStats
- タスクリスト: ステータスごとにグルーピング（Doneは折りたたみ）
- セッション一覧

- [ ] **Step 5: プロジェクト詳細ページ作成**

```tsx
// frontend/app/projects/[id]/page.tsx
"use client";
import { use } from "react";
import { ProjectDetail } from "@/components/project/ProjectDetail";
import { useProject } from "@/lib/hooks/useProjects";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project, isLoading } = useProject(id);

  if (isLoading) return <div>Loading...</div>;
  if (!project) return <div>Not found</div>;

  return <ProjectDetail project={project} />;
}
```

- [ ] **Step 6: ブラウザで動作確認**

`/projects` で一覧表示、カードクリックで詳細ページ遷移。統計カード、タスクリスト、セッション一覧を確認。

- [ ] **Step 7: コミット**

```bash
git add frontend/components/project/ frontend/app/projects/
git commit -m "feat(frontend): プロジェクト一覧・詳細ページを実装"
```

---

## Task 10: セッションページ（一覧 + 詳細）

**Files:**
- Create: `frontend/components/session/SessionList.tsx`
- Create: `frontend/components/session/SessionDetail.tsx`
- Create: `frontend/app/sessions/page.tsx`
- Create: `frontend/app/sessions/[id]/page.tsx`

- [ ] **Step 1: SessionList作成**

セッション一覧。タイトル、ステータス、プロジェクト名、リンクタスク数を表示。ステータスフィルター付き。

- [ ] **Step 2: セッション一覧ページ作成**

```tsx
// frontend/app/sessions/page.tsx
import { SessionList } from "@/components/session/SessionList";
export default function SessionsPage() {
  return <SessionList />;
}
```

- [ ] **Step 3: SessionDetail作成**

2カラムレイアウト:
- メイン: ヘッダー（タイトル、ステータス、LLMCopyButton）、セッションログ一覧（時系列）、リンクタスク一覧
- サイドバー: プロジェクト変更、タスクリンク追加

- [ ] **Step 4: セッション詳細ページ作成**

```tsx
// frontend/app/sessions/[id]/page.tsx
"use client";
import { use } from "react";
import { SessionDetail } from "@/components/session/SessionDetail";
import { useSession } from "@/lib/hooks/useSessions";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, isLoading } = useSession(id);

  if (isLoading) return <div>Loading...</div>;
  if (!session) return <div>Not found</div>;

  return <SessionDetail session={session} />;
}
```

- [ ] **Step 5: ブラウザで動作確認**

`/sessions` で一覧表示、クリックで詳細遷移。ログ一覧、タスクリンク、紐づけ操作を確認。

- [ ] **Step 6: コミット**

```bash
git add frontend/components/session/ frontend/app/sessions/
git commit -m "feat(frontend): セッション一覧・詳細ページを実装"
```

---

## Task 11: ChatPanel移植

**Files:**
- Create: `frontend/components/chat/ChatPanel.tsx`
- Create: `frontend/components/chat/ChatToggleButton.tsx`
- Create: `frontend/components/chat/MessageBubble.tsx`
- Create: `frontend/components/chat/ConfirmDialog.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: MessageBubble作成**

既存 `ChatPanel.tsx` 内のMessageBubbleロジックを移植。`marked` + `dompurify` でMarkdownレンダリング。Preact hooks → React hooks に変換。

- [ ] **Step 2: ConfirmDialog作成**

破壊操作確認ダイアログ。既存ロジック移植。

- [ ] **Step 3: ChatToggleButton作成**

チャットパネルの開閉トグル。

- [ ] **Step 4: ChatPanel作成**

既存ChatPanelの全ロジックを移植。変更点:
- `@preact/signals` → `useState` / `useRef` / `useCallback`
- `bridge*` 関数呼び出しはそのまま移植（`frontend-preact-backup/src/lib/bridge.ts` を参照）
- ストリーミング、ツール実行、モデル選択UIを含む

- [ ] **Step 5: layout.tsxにChatPanel統合**

```tsx
// frontend/app/layout.tsx（更新）
import Providers from "./providers";
import { ChatPanel } from "@/components/chat/ChatPanel";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <div className="flex">
            <main className="flex-1">{children}</main>
            <ChatPanel />
          </div>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: ブラウザで動作確認**

全ページでChatPanelのトグル、メッセージ送受信、ストリーミングを確認。

- [ ] **Step 7: コミット**

```bash
git add frontend/components/chat/ frontend/app/layout.tsx
git commit -m "feat(frontend): ChatPanelを移植"
```

---

## Task 12: ナビゲーション・仕上げ

**Files:**
- Modify: `frontend/app/layout.tsx`
- Modify: 各ページコンポーネント

- [ ] **Step 1: グローバルナビゲーションを追加**

`layout.tsx` にヘッダーナビを追加:
- TaskFlow ロゴ（/ へリンク）
- プロジェクト（/projects）
- セッション（/sessions）

```tsx
<nav className="flex items-center gap-6 px-6 py-3 border-b border-gray-800">
  <Link href="/" className="font-bold">TaskFlow</Link>
  <Link href="/projects">プロジェクト</Link>
  <Link href="/sessions">セッション</Link>
</nav>
```

- [ ] **Step 2: カンバンにフィルター追加**

KanbanBoard にプロジェクト・タグフィルターUI（セレクト or タブ）を追加。

- [ ] **Step 3: 全ページ横断で動作確認**

- `/` — カンバン表示、D&D、フィルター
- `/tasks/[id]` — 詳細表示、紐づけ操作、LLMコピー
- `/projects` — 一覧表示
- `/projects/[id]` — 詳細、統計、タスクリスト、LLMコピー
- `/sessions` — 一覧表示
- `/sessions/[id]` — 詳細、ログ、LLMコピー
- ChatPanel — 全ページで動作
- Realtime — 別タブからAPI変更時にUIが更新される

- [ ] **Step 4: コミット**

```bash
git add frontend/
git commit -m "feat(frontend): ナビゲーション・フィルター・仕上げ"
```

---

## Task 13: 旧フロントエンド削除・デプロイ設定

**Files:**
- Delete: `frontend-preact-backup/`
- Modify: `CLAUDE.md`
- Modify: root `package.json`（scripts更新があれば）

- [ ] **Step 1: 旧フロントエンドを削除**

```bash
rm -rf frontend-preact-backup
```

- [ ] **Step 2: CLAUDE.mdの開発コマンドを更新**

フロントエンドセクションを更新:
```markdown
# フロントエンド
cd frontend && npm run dev      # next dev (port 5173)
cd frontend && npm run build    # next build
cd frontend && npm run preview  # opennextjs-cloudflare preview
cd frontend && npm run deploy   # opennextjs-cloudflare deploy
```

技術スタックの記載も更新（Preact → Next.js, signals → TanStack Query）。

- [ ] **Step 3: デプロイ確認（ローカルプレビュー）**

```bash
cd frontend && npm run preview
```

ブラウザで動作確認。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "chore: 旧Preactフロントエンドを削除、CLAUDE.mdを更新"
```

- [ ] **Step 5: デプロイ**

```bash
cd frontend && npm run deploy
```

---

## 未解決の質問

1. **Cloudflare Pagesのカスタムドメイン設定** — 現在APIは `taskflow.kenji-draemon.workers.dev` だが、フロントエンドのドメインはどうするか？CORS設定の更新が必要になる可能性あり。
2. **ChatPanelのbridge関数** — `frontend-preact-backup/src/lib/bridge.ts` の実装詳細を確認する必要あり。外部エージェント連携がどう動いているか。
3. **GitHub Actionsのデプロイ設定** — 既存のCI/CDにフロントエンドのOpenNextビルド・デプロイを追加する必要があるか。
