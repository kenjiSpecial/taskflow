---
status: complete
priority: p1
issue_id: "002"
tags: [code-review, architecture, performance]
dependencies: []
---

# TaskSearchがストアを迂回してAPI直接呼び出し

## Problem Statement

SessionInlineDetail.tsx内のTaskSearchコンポーネントが `api.fetchTodos()` を直接呼び出しており、既にストアにロード済みのtodosデータを無視。冗長なAPIコール・データ不整合の原因。

## Findings

- **SessionInlineDetail.tsx**: TaskSearch内で `api.fetchTodos({ search })` を直接呼び出し
- 同様にセッション詳細内のtoggleTodoもストアを迂回して `api.updateTodo()` 直接呼び出し
- Architecture, Performance, Code Simplicity の3エージェントが指摘

## Proposed Solutions

### Solution A: ローカルフィルタリング
- `todo-store.ts` の `todos.value` をフィルタリングして検索結果を生成
- Pros: APIコール不要、データ整合性確保、即座に反応
- Cons: 大量タスク時のフロントエンドフィルタコスト（ただし1000件制限あり）
- Effort: Small
- Risk: Low

## Recommended Action

Solution A。ストアの既存データを活用。

## Technical Details

- **Affected files**: `frontend/src/components/SessionInlineDetail.tsx`
- **Related stores**: `frontend/src/stores/todo-store.ts`

## Acceptance Criteria

- [ ] TaskSearchがtodo-storeのtodosからフィルタリングしている
- [ ] toggleTodoがtodo-storeのtoggleTodoを使用している
- [ ] 直接的なapi呼び出しが除去されている

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | ストア層を一貫して使うこと |
