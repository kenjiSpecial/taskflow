---
title: "Preact Signals・ストアアーキテクチャ・FK検証のP1修正"
date: 2026-03-02
category: logic-errors
tags:
  - memory-leak
  - preact-signals
  - store-architecture
  - data-integrity
  - foreign-key-validation
  - code-review
severity: critical
components:
  - frontend/src/components/MatrixRow.tsx
  - frontend/src/components/MatrixView.tsx
  - frontend/src/components/SessionInlineDetail.tsx
  - src/lib/db.ts
  - src/routes/todos.ts
  - src/routes/sessions.ts
symptoms:
  - "レンダー毎にcomputedシグナルが蓄積しメモリ使用量が増加"
  - "TaskSearchのAPI直接呼び出しでストアとUIのデータ不整合"
  - "存在しないproject_idでtodo/session作成が可能"
root_cause: "computed()のライフサイクル未管理、ストア層の迂回、D1のFK制約不完全"
resolution: "useComputed()置換、ストア経由フィルタリング、projectExists()バリデーション追加"
---

# Preact Signals・ストアアーキテクチャ・FK検証のP1修正

統合マトリクスビュー実装後の6エージェントコードレビューで発見されたP1（Critical）3件の修正記録。

## 問題の概要

| # | 問題 | 影響 | カテゴリ |
|---|------|------|----------|
| 001 | `computed()`をレンダー関数内で使用 | メモリリーク | Frontend |
| 002 | TaskSearchがストア層を迂回 | データ不整合・冗長APIコール | Frontend |
| 003 | project_id存在チェック不足 | データ整合性違反 | Backend |

---

## Fix 1: computed() → useComputed()（メモリリーク防止）

### 原因

`@preact/signals` の `computed()` はモジュールレベルで永続的なリアクティブサブスクリプションを作成する。Preact関数コンポーネント内で呼ぶと、**レンダー毎に新しいcomputedが生成され、古いものが破棄されない**。

### 修正

`useComputed()` はコンポーネントのライフサイクルにフックし、アンマウント時に自動破棄される。

**Before:**
```tsx
import { computed } from "@preact/signals";

export function MatrixRow({ projectId }) {
  // 毎レンダーで新しいcomputed生成 → メモリリーク
  const projectSessions = computed(() =>
    sessions.value.filter(s => s.project_id === projectId)
  );
}
```

**After:**
```tsx
import { useComputed } from "@preact/signals";

export function MatrixRow({ projectId }) {
  // ライフサイクル管理付き → 安全
  const projectSessions = useComputed(() =>
    sessions.value.filter(s => s.project_id === projectId)
  );
}
```

**影響ファイル:**
- `MatrixRow.tsx`: 6箇所（projectSessions, activeSessions, pausedSessions, doneSessions, projectTodos, expandedInThisRow）
- `MatrixView.tsx`: 1箇所（uncategorizedExists）

### ルール

| 使用場所 | 使うAPI |
|---------|---------|
| モジュールレベル（store等） | `computed()` |
| コンポーネント内 | `useComputed()` |
| コンポーネント内の状態 | `useSignal()` |

---

## Fix 2: TaskSearchをストア経由に変更（データ整合性確保）

### 原因

`SessionInlineDetail.tsx` の `TaskSearch` コンポーネントが `api.fetchTodos()` を直接呼び出し、todo-storeに既にロード済みのデータを無視。`handleToggleTodo` も `api.updateTodo()` を直接呼び出してストアの楽観的更新や子タスク完了チェックをバイパス。

### 修正

ストアの `todos.value` からフィルタリングし、`toggleTodo()` を使用。

**Before:**
```tsx
// API直接呼び出し → 冗長 & ストアと不整合
const res = await api.fetchTodos({ limit: "20" });
results.value = res.todos.filter(t => t.title.toLowerCase().includes(q));

// ストアのtoggleTodo()をバイパス
const handleToggleTodo = async (todo: Todo) => {
  await api.updateTodo(todo.id, { status: newStatus });
  await loadLinkedTasks(sessionId);
  await loadSessions(); // 全セッション再取得
};
```

**After:**
```tsx
// ストアの既存データをフィルタリング → APIコール不要
const results = q.length > 0
  ? todos.value.filter(t =>
      t.title.toLowerCase().includes(q) &&
      !linkedIds.has(t.id) &&
      t.status !== "completed"
    ).slice(0, 20)
  : [];

// ストア経由 → 楽観的更新・子タスク完了チェックが効く
const handleToggleTodo = async (todo: Todo) => {
  await toggleTodo(todo.id, todo.status);
  await loadLinkedTasks(sessionId);
};
```

**影響ファイル:** `SessionInlineDetail.tsx`

### ルール

コンポーネントからデータを取得・変更する場合は**必ずストア経由**。`import * as api` をコンポーネントで使うのはアンチパターン。

---

## Fix 3: project_id存在チェック追加（データ整合性）

### 原因

D1（SQLite on Cloudflare）のFK制約は完全に信頼できない。todosとsessionsのCREATE/UPDATE APIが `project_id` の値を検証せず、存在しないプロジェクトへの参照が可能だった。

### 修正

`projectExists()` ヘルパー関数を追加し、4箇所（todos POST/PATCH, sessions POST/PATCH）で使用。

```typescript
// src/lib/db.ts
export async function projectExists(db: D1Database, projectId: string): Promise<boolean> {
  const row = await db.prepare(
    "SELECT 1 FROM projects WHERE id = ? AND deleted_at IS NULL"
  ).bind(projectId).first();
  return row !== null;
}
```

```typescript
// 各ルートのPOST/PATCHで使用
if (data.project_id) {
  if (!(await projectExists(c.env.DB, data.project_id))) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Project not found" } }, 400);
  }
}
```

**影響ファイル:** `src/lib/db.ts`, `src/routes/todos.ts`, `src/routes/sessions.ts`

### ルール

D1のFK制約に依存せず、**アプリケーション層で明示的に存在チェック**する。

---

## 防止策

### CLAUDE.mdに追加すべきルール

```
- コンポーネント内では useComputed() / useSignal() を使う（computed() / signal() はモジュールレベル専用）
- コンポーネントからの直接API呼び出し禁止。必ずストア経由で操作する
- D1のFK制約に依存しない。CREATE/UPDATE時にアプリ層で存在チェックする
```

### コードレビューチェックリスト

- [ ] `import { computed } from "@preact/signals"` がコンポーネントファイルにないか？
- [ ] `import * as api from "../lib/api"` がコンポーネントファイルにないか？
- [ ] FK参照カラム（`*_id`）のCREATE/UPDATEに存在チェックがあるか？

### 注意すべきパターン

| 危険パターン | 安全パターン |
|-------------|-------------|
| コンポーネント内で `computed()` | `useComputed()` を使う |
| コンポーネントで `api.fetchXxx()` | ストアの `signal.value` をフィルタ |
| コンポーネントで `api.updateXxx()` | ストアのアクション関数を呼ぶ |
| D1 FK制約のみ | `projectExists()` 等で明示チェック |

---

## 関連ドキュメント

- [統合マトリクスビュー ブレインストーム](../../brainstorms/2026-03-02-unified-matrix-view-brainstorm.md)
- [統合マトリクスビュー 実装プラン](../../plans/2026-03-02-feat-unified-matrix-view-plan.md)
- [Preact Signal誤用パターン](../ui-bugs/preact-signal-misuse-and-code-review-fixes.md)
- [親子タスクUI プラン](../../plans/2026-03-01-feat-task-parent-child-ui-plan.md)

## 検証

- TypeScript型チェック: 通過
- フロントエンドビルド: 成功
- 全49テスト: 通過
- コミット: `eb86bff` (`fix: P1レビュー指摘3件を修正`)
