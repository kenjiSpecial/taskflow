---
title: "Preact Signal誤用とコードレビュー修正"
date: 2026-02-27
category: ui-bugs
tags:
  - preact
  - signals
  - useSignal
  - performance
  - security
  - cors
  - d1
  - cloudflare
  - typescript
  - code-review
components:
  - frontend/src/components/TodoItem.tsx
  - frontend/src/components/TodoForm.tsx
  - frontend/src/stores/todo-store.ts
  - frontend/src/lib/api.ts
  - src/middleware/cors.ts
  - src/routes/todos.ts
severity: P1-P2
status: resolved
search_terms:
  - useSignal vs signal preact
  - signal inside component body
  - O(n^2) child lookup
  - CORS wildcard pages.dev
  - D1 RETURNING clause
  - fetchTodos limit pagination
  - Partial type safety
---

# Preact Signal誤用とコードレビュー修正

## Problem Statement

Taskflowプロジェクト（Hono + D1 + Preact on Cloudflare）の多角的コードレビューで、3件のP1バグと5件のP2問題を検出。最も深刻なのはPreact SignalsのAPI誤用で、編集モードが即座にリセットされるバグを引き起こしていた。

## Findings

### P1-1: signal() inside component body (CRITICAL BUG)

`TodoItem.tsx`で`signal()`をコンポーネント関数本体内で呼び出していた。Preact Signalsでは`signal()`は毎回新しいリアクティブコンテナを生成するため、レンダー毎に状態がリセットされる。

**症状:** 編集ボタンをクリックしても編集モードが一瞬表示されて消える。

```typescript
// BEFORE (BUG: 毎レンダーで新規signal生成)
export function TodoItem({ todo }: Props) {
  const editing = signal(false);        // 毎回リセット
  const editTitle = signal(todo.title); // 毎回リセット
}

// AFTER (FIXED: useSignalでhookベースの永続化)
import { useSignal } from "@preact/signals";

export function TodoItem({ todo }: Props) {
  const editing = useSignal(false);        // レンダー間で保持
  const editTitle = useSignal(todo.title); // レンダー間で保持
}
```

`useSignal`は内部で`useRef`を使用し、同一のsignalインスタンスをレンダー間で維持する。

### P1-2: Module-level signals in TodoForm (BUG)

`TodoForm.tsx`はモジュールレベルでsignalを定義していた。単一インスタンスでは動作するが、複数インスタンスでstate共有が発生する。

```typescript
// BEFORE
const title = signal("");         // グローバル共有
const submitting = signal(false); // グローバル共有

// AFTER
export function TodoForm() {
  const title = useSignal("");         // コンポーネントスコープ
  const submitting = useSignal(false); // コンポーネントスコープ
}
```

### P1-3: fetchTodos limit=50 でデータ欠落

`loadTodos()`がパラメータなしで`fetchTodos()`を呼び出し、バックエンドのデフォルトlimit=50が適用されていた。50件超のTODOが画面に表示されない。

```typescript
// BEFORE
const res = await api.fetchTodos(); // limit=50がデフォルト適用

// AFTER
const res = await api.fetchTodos({ limit: "1000" }); // 明示的に指定
```

### P2-4: CORS が全 *.pages.dev を許可

`origin.endsWith(".pages.dev")`は全Cloudflare Pagesサイトからのリクエストを許可していた。

```typescript
// BEFORE
if (origin.endsWith(".pages.dev")) return origin; // 全pages.devサイト許可

// AFTER
if (origin.endsWith(".taskflow-ui.pages.dev")) return origin; // 自サイトのみ
```

### P2-5: O(n^2) child lookup

各`TodoItem`が`todos.value.filter()`で全todoをスキャンしていた。

```typescript
// BEFORE: O(n) per component, O(n^2) total
const children = todos.value.filter((t) => t.parent_id === todo.id);

// AFTER: O(n) preprocessing, O(1) per component
// store に追加
export const childrenMap = computed(() => {
  const map = new Map<string, Todo[]>();
  for (const todo of todos.value) {
    if (todo.parent_id) {
      const siblings = map.get(todo.parent_id) || [];
      siblings.push(todo);
      map.set(todo.parent_id, siblings);
    }
  }
  return map;
});

// component で使用
const children = childrenMap.value.get(todo.id) || [];
```

### P2-6: Silent error swallowing

```typescript
// BEFORE
catch (_) { /* silent */ }

// AFTER
catch (e) { console.error("Failed to load projects:", e); }
```

### P2-7: Partial<Todo> が広すぎる

```typescript
// BEFORE: id, deleted_at等も送信可能
export async function createTodo(data: Partial<Todo>)

// AFTER: 必要なフィールドのみ
export type CreateTodoInput = Pick<Todo, "title"> &
  Partial<Pick<Todo, "description" | "priority" | "due_date" | "project" | "parent_id" | "sort_order">>;

export type UpdateTodoInput = Partial<
  Pick<Todo, "title" | "description" | "status" | "priority" | "due_date" | "project" | "parent_id" | "sort_order">
>;
```

### P2-8: D1 double queries

```typescript
// BEFORE: 2 queries per write
await c.env.DB.prepare(`INSERT INTO todos (...) VALUES (...)`).bind(...).run();
const todo = await c.env.DB.prepare("SELECT * FROM todos WHERE id = ?").bind(id).first();

// AFTER: 1 query with RETURNING
const todo = await c.env.DB.prepare(
  `INSERT INTO todos (...) VALUES (...) RETURNING *`
).bind(...).first<TodoRow>();
```

## Root Cause

1. **Signal API理解不足**: Preact Signalsの`signal()`と`useSignal()`の違いを理解していなかった。`signal()`はReactの`useState()`と異なり、hook identityを持たない。
2. **暗黙のデフォルト値**: バックエンドのlimit=50がフロントエンドに伝わっていなかった。
3. **共有ドメインの認識不足**: `*.pages.dev`がCloudflare全体の共有ドメインであることを考慮していなかった。

## Prevention

### signal() vs useSignal() ルール

- コンポーネント内の状態: 常に`useSignal()`を使用
- グローバルストア: `signal()`をモジュールレベルで使用
- ESLintカスタムルールで`signal()`のコンポーネント内使用を検出

### API境界の型安全性

- `Partial<Entity>`をAPIクライアントで使わない
- `Pick` + `Partial`で送信可能フィールドを明示
- Zodスキーマとフロントエンド型を一致させる

### CORS設定チェックリスト

- [ ] ワイルドカードパターン(`*`)を使わない
- [ ] 共有ホスティングドメインのサブドメインを制限
- [ ] 明示的なホワイトリストを使用

### D1クエリ最適化

- INSERT/UPDATEには`RETURNING *`を使用
- 複数クエリは`batch()`でまとめる
- `computed` signalで派生データを事前計算

## Impact

| 修正 | カテゴリ | 影響 |
|------|---------|------|
| signal → useSignal | バグ修正 | 編集モードが動作するように |
| limit=1000 | データ整合性 | 全TODOが表示される |
| CORS制限 | セキュリティ | 不正オリジンからのアクセス防止 |
| childrenMap | パフォーマンス | O(n^2)→O(n) |
| RETURNING * | パフォーマンス | D1クエリ50%削減 |

## References

- Commit: `8b19b16` - `fix: コードレビューP1/P2指摘の修正`
- [@preact/signals docs - useSignal](https://preactjs.com/guide/v10/signals/)
- [D1 RETURNING clause](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages CORS](https://developers.cloudflare.com/pages/)
