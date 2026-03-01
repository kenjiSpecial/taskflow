---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, quality, code-simplicity]
dependencies: []
---

# 未使用コード・デッドコードの削除

## Problem Statement

旧UIから新マトリクスUIへの移行で、複数の未使用エクスポート・関数・変数が残存。コードの可読性と保守性を低下させている。

## Findings

以下が未使用と判定：

### Stores
- `session-store.ts`: `filter`, `filteredSessions`, `activeSessions` エクスポート
- `todo-store.ts`: `dragState.dropProjectId` フィールド（常にundefined）

### Components
- `MatrixRow.tsx`: `rowClass` 変数（定義のみ、未使用）
- `TasksCell.tsx`: `childrenMap` インポート（使われていない）

### API Client
- `api.ts`: `fetchTodo()`, `fetchSession()`, `fetchTodoSessions()` 関数

### Legacy
- `TodoForm.tsx`, `TodoItem.tsx` - 旧フルビュー用（マトリクスではMiniTodoItem使用）
  - ただしTodoItemはD&D機能で使用中の可能性があるため要確認

## Proposed Solutions

### Solution A: 一括削除
- 上記全てを削除
- Pros: クリーンなコード
- Cons: TodoItem使用箇所の確認必要
- Effort: Small
- Risk: Low（ビルドで検証可能）

## Acceptance Criteria

- [ ] 未使用store エクスポートが削除されている
- [ ] 未使用API関数が削除されている
- [ ] 未使用変数・インポートが削除されている
- [ ] ビルド・型チェック通過
- [ ] TodoForm/TodoItemの使用状況を確認済み

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | UI大規模変更後は未使用コード掃除が必要 |
