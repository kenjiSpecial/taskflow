---
title: "feat: セッション画面にサブタスク展開表示を追加"
type: feat
status: completed
date: 2026-03-06
brainstorm: docs/brainstorms/2026-03-06-session-subtask-display-brainstorm.md
---

# feat: セッション画面にサブタスク展開表示を追加

## Overview

セッション画面（SessionDetailPanel / SessionInlineDetail）で、リンクされた親タスクの下にサブタスクを展開/折り畳み表示する。現状は親タスクのみ表示でサブタスクの進捗が見えない。

**API変更不要** — todo-storeの既存`childrenMap`/`taskProgress`を活用し、フロントエンドのみの変更で実現する。

## 実装方針

### データの流れ

```
linkedTasks (session-store)  →  親タスク一覧
childrenMap (todo-store)     →  親ID → 子タスク配列
taskProgress (todo-store)    →  親ID → {completed, total}
```

セッションのlinkedTasksは親タスクのみ。各親タスクのサブタスクはtodo-storeのchildrenMapから取得する。

### 変更対象ファイル（2ファイル）

#### 1. `frontend/src/components/project-detail/SessionDetailPanel.tsx`

**変更箇所: 行130-148（関連タスク表示部分）**

- `childrenMap`と`taskProgress`をtodo-storeからimport
- 各親タスクに対して:
  - サブタスクがある場合、展開/折り畳みトグル（▼/▶）を追加
  - 親タスク横に進捗バッジ `[2/3]` を表示
  - 展開時、親タスクの下にサブタスクをインデント表示（読み取り専用）
- 展開状態は`useSignal<Set<string>>`で管理（展開中の親タスクIDのSet）

**参考パターン:**
- TodoItem.tsx:32,147-154 — 展開/折り畳みロジック
- TasksSection.tsx:114-120 — 子タスク表示の`ml-6 border-l`スタイル
- todo-store.ts:16-26 — childrenMap
- todo-store.ts:34-45 — taskProgress

#### 2. `frontend/src/components/SessionInlineDetail.tsx`

**変更箇所: 行194-212（関連タスク表示部分）**

SessionDetailPanelと同じロジックを適用。SessionInlineDetailはマトリックスビュー内で使われるため、コンパクトさを維持しつつサブタスク展開を追加する。

### UI仕様

```
☑ 親タスク A           ▼ [2/3]
  ├ ☑ サブタスク A-1
  ├ ☑ サブタスク A-2
  └ ☐ サブタスク A-3
☐ 親タスク B           ▶ [0/1]
☐ 親タスク C（サブなし）
```

- 展開トグル: サブタスクがある親タスクのみ表示
- 進捗バッジ: サブタスクがある親タスクの右側に `[completed/total]`
- サブタスク行: インデント + 左ボーダー、チェックボックスは表示のみ（操作不可）
- サブタスクのステータスに応じてチェック表示（completed = ☑）

### 注意事項

- コンポーネント内では`useSignal()`を使用（`signal()`はNG — CLAUDE.md規約）
- サブタスクのチェックボックスはdisabled（読み取り専用）
- childrenMapにデータがない場合（タスクデータ未ロード）はサブタスク非表示でフォールバック

## Acceptance Criteria

- [x] SessionDetailPanelで親タスクの下にサブタスクが展開表示される
- [x] SessionInlineDetailでも同様にサブタスク展開表示される
- [x] 展開/折り畳みトグルが動作する
- [x] 親タスク横に進捗バッジ [completed/total] が表示される
- [x] サブタスクは読み取り専用（操作不可）
- [x] サブタスクがない親タスクにはトグル・バッジが表示されない

## References

- ブレスト: `docs/brainstorms/2026-03-06-session-subtask-display-brainstorm.md`
- 展開パターン: `frontend/src/components/TodoItem.tsx:32,147-154`
- 子タスク表示: `frontend/src/components/project-detail/TasksSection.tsx:114-120`
- childrenMap: `frontend/src/stores/todo-store.ts:16-26`
- taskProgress: `frontend/src/stores/todo-store.ts:34-45`
- セッションタスク表示: `frontend/src/components/project-detail/SessionDetailPanel.tsx:130-148`
- インラインタスク表示: `frontend/src/components/SessionInlineDetail.tsx:194-212`
