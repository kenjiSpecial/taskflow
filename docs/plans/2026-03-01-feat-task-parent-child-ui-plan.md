---
title: "feat: タスク親子関連付けUI"
type: feat
status: completed
date: 2026-03-01
brainstorm: docs/brainstorms/2026-03-01-task-parent-child-ui-brainstorm.md
---

# feat: タスク親子関連付けUI

## Overview

既存バックエンドの親子タスク機能（`parent_id`、2階層制限）に対して、フル機能のフロントエンドUIを構築する。サブタスク作成、トグル式ツリー表示、進捗カウント、全子完了時の親完了確認、HTML Native D&Dによるタスク移動・並び替えを実装する。

## 設計判断（SpecFlow分析結果を反映）

| 項目 | 決定 | 理由 |
|------|------|------|
| サブタスク作成UI | TodoItemに「+」ボタン → インライン入力 | 軽量な追加方法 |
| 「+」ボタン表示条件 | 親タスクのみ（子タスクには非表示） | 2階層制限 |
| 完了済タスクの「+」 | 表示する | サブタスク追加の自由度 |
| ツリー表示 | トグル式（▶/▼）、デフォルト展開 | 一覧の見やすさ |
| 子なしタスクのアイコン | 非表示 | ノイズ削減 |
| 展開状態の永続化 | しない（リロードで全展開にリセット） | YAGNI |
| 進捗表示 | 「2/5完了」テキスト、タイトル右横 | シンプル |
| 進捗の分母 | deleted_at IS NULLの全子タスク | セッション進捗と同パターン |
| 子タスクが0件 | 進捗非表示 | ノイズ削減 |
| 全子完了時 | `window.confirm`で確認 | 最小工数 |
| 親completed + 子をpendingに戻し | 親は放置 | 個人ツールなので手動で対応 |
| D&D方式 | HTML Native Drag and Drop | ライブラリ不要 |
| D&D操作区別 | 上端/下端→並び替えインジケーター、中央→子にする | 3分割ゾーン |
| 子持ちタスクのドラッグ | 子も一緒に移動（別タスクの子にする場合は3階層で拒否） | 自然な挙動 |
| sort_order更新 | バッチAPI新設（`PATCH /api/todos/reorder`） | リクエスト数削減 |
| フィルタ時の子タスク | 現状維持（親のみフィルタ、子は全表示） | 既存挙動を維持 |
| 新規サブタスクの属性継承 | projectのみ親から継承 | 最小限 |
| モバイルD&D | 非対応 | HTML Native D&Dの制約 |
| サブタスク作成位置 | 子タスクリストの末尾 | 自然な追加順 |

## Implementation Phases

### Phase 1: バックエンドAPI修正

#### 1-1. PATCH depth検証バグ修正

**`src/routes/todos.ts`** PATCHハンドラに追加:

```typescript
// parent_id変更時の階層チェック
if (data.parent_id !== undefined) {
  if (data.parent_id === id) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot set self as parent" } }, 400);
  }
  if (data.parent_id) {
    const parent = await c.env.DB.prepare(
      "SELECT parent_id FROM todos WHERE id = ? AND deleted_at IS NULL",
    ).bind(data.parent_id).first<{ parent_id: string | null }>();
    if (!parent) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Parent todo not found" } }, 400);
    }
    if (parent.parent_id) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot create subtask of a subtask (max 2 levels)" } }, 400);
    }
    // 子持ちタスクを別タスクの子にしようとした場合（3階層防止）
    const hasChildren = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM todos WHERE parent_id = ? AND deleted_at IS NULL",
    ).bind(id).first<{ count: number }>();
    if (hasChildren && hasChildren.count > 0) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot nest a task that has children (max 2 levels)" } }, 400);
    }
  }
}
```

#### 1-2. バッチreorder API

**`src/routes/todos.ts`** に追加:

| Method | Path | 説明 |
|--------|------|------|
| PATCH | `/api/todos/reorder` | 複数タスクのsort_order + parent_id を一括更新 |

**`src/validators/todo.ts`** に追加:

```typescript
export const reorderTodosSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    sort_order: z.number().int().min(0),
    parent_id: z.string().nullable().optional(),
  })).min(1).max(100),
});
```

**実装:**

```typescript
app.patch("/reorder", async (c) => {
  const body = await c.req.json();
  const data = reorderTodosSchema.parse(body);

  // 階層バリデーション（全itemsの整合性チェック）
  // ...

  const stmts = data.items.map((item) => {
    if (item.parent_id !== undefined) {
      return c.env.DB.prepare(
        "UPDATE todos SET sort_order = ?, parent_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      ).bind(item.sort_order, item.parent_id, timestamp, item.id);
    }
    return c.env.DB.prepare(
      "UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    ).bind(item.sort_order, timestamp, item.id);
  });

  await c.env.DB.batch(stmts);
  return c.json({ success: true });
});
```

#### 1-3. loadTodosのデフォルトソート変更

**`src/routes/todos.ts`** GET一覧: デフォルトsortを `sort_order` ASC → `created_at` DESC のフォールバック。

```typescript
const sort = query.sort || "sort_order";
const order = query.order || "asc";
```

#### 1-4. テスト

**`test/todos.test.ts`** に追加:

- PATCH: parent_id変更時の階層チェック（子を孫にする試み → 400）
- PATCH: 自己参照 → 400
- PATCH: 子持ちタスクを別タスクの子にする → 400
- PATCH: parent_id を null に変更（トップレベルに戻す）→ 成功
- PATCH /reorder: 正常な並び替え → 成功
- PATCH /reorder: 空配列 → 400
- GET /api/todos: sort_orderでソートされること

### Phase 2: フロントエンド - ツリー表示 + 進捗

#### 2-1. ストア更新

**`frontend/src/stores/todo-store.ts`** に追加:

```typescript
// 親タスクの進捗計算
export const taskProgress = computed(() => {
  const progress = new Map<string, { completed: number; total: number }>();
  for (const todo of todos.value) {
    if (todo.parent_id && !todo.deleted_at) {
      const p = progress.get(todo.parent_id) || { completed: 0, total: 0 };
      p.total++;
      if (todo.status === "completed") p.completed++;
      progress.set(todo.parent_id, p);
    }
  }
  return progress;
});
```

`loadTodos`のデフォルトパラメータを `sort: "sort_order", order: "asc"` に変更。

#### 2-2. TodoItem トグル + 進捗

**`frontend/src/components/TodoItem.tsx`** 更新:

```typescript
export function TodoItem({ todo }: Props) {
  const editing = useSignal(false);
  const editTitle = useSignal(todo.title);
  const expanded = useSignal(true); // デフォルト展開

  const children = childrenMap.value.get(todo.id) || [];
  const progress = taskProgress.value.get(todo.id);
  const isChild = !!todo.parent_id;

  return (
    <div>
      <div class={`todo-item ${todo.status === "completed" ? "completed" : ""}`}>
        {/* トグルボタン（子ありの場合のみ） */}
        {children.length > 0 && (
          <button class="btn-toggle" onClick={() => expanded.value = !expanded.value}>
            {expanded.value ? "▼" : "▶"}
          </button>
        )}

        {/* チェックボックス */}
        <input type="checkbox" ... />

        <div class="todo-content">
          <div class="todo-title-row">
            <span class="todo-title">{todo.title}</span>
            {progress && progress.total > 0 && (
              <span class="todo-progress">{progress.completed}/{progress.total}完了</span>
            )}
          </div>
          <div class="todo-meta">...</div>
        </div>

        <div class="todo-actions">
          {!isChild && <button class="btn-ghost" onClick={...}>+</button>}
          <button class="btn-ghost" onClick={handleEdit}>編集</button>
          <button class="btn-danger" onClick={handleDelete}>削除</button>
        </div>
      </div>

      {/* 子タスク（展開時のみ表示） */}
      {expanded.value && children.length > 0 && (
        <div class="todo-children">
          {children.map((child) => (
            <TodoItem key={child.id} todo={child} />
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 2-3. 全子完了時の親完了確認

**`frontend/src/stores/todo-store.ts`** `editTodo`を拡張:

```typescript
export async function toggleTodo(id: string, currentStatus: string) {
  const newStatus = currentStatus === "completed" ? "pending" : "completed";
  const res = await api.updateTodo(id, { status: newStatus });
  todos.value = todos.value.map((t) => (t.id === id ? res.todo : t));

  // 子タスクを完了にした場合、親の全子チェック
  if (newStatus === "completed" && res.todo.parent_id) {
    const siblings = childrenMap.value.get(res.todo.parent_id) || [];
    const allDone = siblings.every((s) =>
      s.id === id ? true : s.status === "completed"
    );
    if (allDone) {
      const parent = todos.value.find((t) => t.id === res.todo.parent_id);
      if (parent && parent.status !== "completed") {
        if (window.confirm(`全子タスク完了。「${parent.title}」も完了にしますか？`)) {
          await editTodo(parent.id, { status: "completed" });
        }
      }
    }
  }
}
```

#### 2-4. サブタスク作成

**`frontend/src/components/TodoItem.tsx`** に追加:

```typescript
// 「+」ボタン押下 → インライン入力表示
const addingChild = useSignal(false);
const childTitle = useSignal("");

const handleAddChild = async () => {
  const title = childTitle.value.trim();
  if (!title) return;
  await addTodo({ title, parent_id: todo.id, project: todo.project || undefined });
  childTitle.value = "";
  addingChild.value = false;
  expanded.value = true; // 追加後は展開
};
```

インライン入力: 子タスクリストの末尾に表示。Enter確定、Escape取消。

#### 2-5. スタイル

**`frontend/src/styles/global.css`** に追加:

```css
.btn-toggle {
  background: transparent;
  color: var(--text-muted);
  padding: 0;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 0.625rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-toggle:hover { color: var(--text); }

.todo-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.todo-progress {
  font-size: 0.75rem;
  color: var(--success);
  font-weight: 500;
  white-space: nowrap;
}

.subtask-form {
  display: flex;
  gap: 0.5rem;
  padding: 0.375rem 0;
}

.subtask-form input {
  flex: 1;
  font-size: 0.8125rem;
  padding: 0.375rem 0.5rem;
}
```

### Phase 3: HTML Native D&D

#### 3-1. APIクライアント

**`frontend/src/lib/api.ts`** に追加:

```typescript
export interface ReorderItem {
  id: string;
  sort_order: number;
  parent_id?: string | null;
}

export async function reorderTodos(items: ReorderItem[]): Promise<void> {
  await request("/api/todos/reorder", {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}
```

#### 3-2. ストア

**`frontend/src/stores/todo-store.ts`** に追加:

```typescript
export async function reorderTodos(items: api.ReorderItem[]) {
  // 楽観的更新
  const prev = todos.value;
  todos.value = todos.value.map((t) => {
    const item = items.find((i) => i.id === t.id);
    if (!item) return t;
    return {
      ...t,
      sort_order: item.sort_order,
      ...(item.parent_id !== undefined ? { parent_id: item.parent_id } : {}),
    };
  });

  try {
    await api.reorderTodos(items);
  } catch {
    todos.value = prev; // ロールバック
  }
}
```

#### 3-3. TodoItemにD&D実装

**`frontend/src/components/TodoItem.tsx`** に追加:

D&D状態管理（モジュールレベルsignal）:

```typescript
// frontend/src/stores/todo-store.ts に追加
export const dragState = signal<{
  dragId: string | null;
  dropTarget: { id: string; position: "before" | "inside" | "after" } | null;
}>({ dragId: null, dropTarget: null });
```

TodoItemのD&Dハンドラ:

- `draggable="true"`
- `onDragStart`: dragState.dragIdを設定
- `onDragOver`: マウスY位置からposition判定（上1/4 = before、中央1/2 = inside、下1/4 = after）
  - inside判定時: 2階層制限チェック（自身が子タスク or ドラッグ元が子持ち → insideを禁止しbeforeに変更）
- `onDragLeave`: dropTarget解除
- `onDrop`: reorderTodos呼び出し
- `onDragEnd`: dragState全リセット

ドロップゾーン（リスト末尾）:
- TodoListの末尾に透明なドロップエリア → トップレベルの末尾に配置

視覚フィードバック:
- before/after: 上端/下端に水平線（border-top / border-bottom）
- inside: 背景ハイライト（var(--surface-hover)）
- 無効なドロップ先: カーソル `not-allowed`

```css
/* D&D styles */
.todo-item.drag-over-before { border-top: 2px solid var(--accent); }
.todo-item.drag-over-after { border-bottom: 2px solid var(--accent); }
.todo-item.drag-over-inside { background: var(--surface-hover); }
.todo-item.dragging { opacity: 0.5; }
.todo-drop-zone {
  height: 2rem;
  border: 2px dashed transparent;
  border-radius: var(--radius);
  transition: border-color 0.15s;
}
.todo-drop-zone.active { border-color: var(--accent); }
```

#### 3-4. テスト

フロントエンドのD&Dは手動テスト。バックエンドの `/api/todos/reorder` はPhase 1テストでカバー。

### Phase 4: CLI連携

**`~/.agents/skills/taskflow/SKILL.md`** に追加:

- `/taskflow add <タイトル> --parent <親タスク検索ワード>`: サブタスク作成

## Acceptance Criteria

### Functional Requirements

- [x] 親タスクに「+」ボタンでサブタスク作成できる
- [x] 子タスクには「+」ボタンが表示されない（2階層制限）
- [x] ツリーの展開/折りたたみがトグルで切り替えられる
- [x] 親タスクに「2/5完了」の進捗カウントが表示される
- [x] 全子タスク完了時に親の完了確認が表示される
- [x] D&Dでタスクの並び替え（sort_order更新）ができる
- [x] D&Dでタスクを別タスクの子にできる（中央ドロップ）
- [x] D&Dで子タスクをトップレベルに戻せる（リスト末尾ドロップ）
- [x] 2階層制限違反のD&D操作が拒否される
- [x] PATCH時のparent_id階層チェックが機能する
- [x] 自己参照・循環参照が拒否される
- [x] バッチreorder APIで複数タスクの順序が一括更新される
- [x] sort_orderで一覧がソートされる
- [x] CLIでサブタスク作成ができる（既存の--parentオプション）

### Quality Gates

- [x] `npm test` 全テスト通過（49テスト）
- [x] `npm run typecheck` エラーなし
- [x] `cd frontend && npm run build` エラーなし
- [x] 既存のtodo/session機能に影響なし

## Dependencies & Risks

- HTML Native D&Dのブラウザ互換性（モダンブラウザは問題なし、モバイルは非対応と割り切り）
- D&Dの3分割ゾーン判定の精度（上1/4 = before、中央1/2 = inside、下1/4 = after）
- 楽観的更新のロールバック: API失敗時にUI状態を復元する必要あり
- sort_orderのデフォルトソート変更: 既存データのsort_orderがすべて0の場合、created_at順にフォールバック必要

## References

- ブレインストーム: `docs/brainstorms/2026-03-01-task-parent-child-ui-brainstorm.md`
- 既存親子実装: `src/routes/todos.ts:89-136`（POST階層チェック）
- フロントエンドツリー: `frontend/src/stores/todo-store.ts:25-39`（parentTodos, childrenMap）
- TodoItem: `frontend/src/components/TodoItem.tsx`
- セッション進捗パターン: `frontend/src/components/SessionCard.tsx:41-45`
- Preact Signal教訓: `docs/solutions/ui-bugs/preact-signal-misuse-and-code-review-fixes.md`
- テスト: `test/todos.test.ts:82-105`（子タスク作成・孫拒否テスト）
