---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, typescript, quality]
dependencies: []
---

# TypeScript型安全性の改善

## Problem Statement

複数箇所で型定義が緩く、ランタイムエラーのリスクがある。

## Findings

### Critical
- `src/lib/db.ts`: `buildWhereClause` で `string` 型だがユニオンリテラルが適切
- `statusLabel` 関数: `Record<string, string>` → `Record<Todo["status"], string>`
- `toggleTodo` パラメータ: `currentStatus: string` → `Todo["status"]`

### Medium
- APIレスポンスの型定義が緩い（例: `{ todo: Todo }` の明示化）
- フィルター型が `Record<string, string>` で緩い

## Proposed Solutions

### Solution A: 段階的型強化
- Critical項目を先に修正、Mediumは次のイテレーションで
- Effort: Small (Critical) / Medium (全体)
- Risk: Low

## Technical Details

- **Affected files**: `src/lib/db.ts`, `frontend/src/stores/todo-store.ts`, `frontend/src/components/SessionCell.tsx`

## Acceptance Criteria

- [ ] db.tsの文字列パラメータがユニオン型に
- [ ] statusLabelが型安全に
- [ ] toggleTodoのパラメータが型安全に
- [ ] 型チェック通過

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | |
