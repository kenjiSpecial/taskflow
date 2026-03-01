---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, performance, architecture]
dependencies: []
---

# computed()をレンダー関数内で使用（メモリリーク）

## Problem Statement

MatrixRow.tsxとMatrixView.tsxで `computed()` をレンダー関数内で呼び出しており、レンダーの度に新しいcomputedシグナルが生成され、古いものがGCされない。パフォーマンス劣化とメモリリークの原因。

## Findings

- **MatrixRow.tsx**: `rowSessions`, `rowTodos` が関数コンポーネント内で `computed()` 生成
- **MatrixView.tsx**: `uncategorizedSessions`, `uncategorizedTodos` が同様
- 6エージェント中4つ（Performance, Architecture, TypeScript, Pattern Recognition）が指摘

## Proposed Solutions

### Solution A: useComputed() に置換
- `@preact/signals` の `useComputed()` を使う
- Pros: 最小変更、Preact公式パターン
- Cons: なし
- Effort: Small
- Risk: Low

### Solution B: store層でインデックス化
- `todosByProjectId`, `sessionsByProjectId` をstore側で `computed()` として定義
- Pros: O(1)ルックアップ、全コンポーネントで再利用可能
- Cons: やや大きい変更
- Effort: Medium
- Risk: Low

## Recommended Action

Solution A + B の両方。まずAで即時修正、次にBでストア最適化。

## Technical Details

- **Affected files**: `frontend/src/components/MatrixRow.tsx`, `frontend/src/components/MatrixView.tsx`
- **Related stores**: `frontend/src/stores/todo-store.ts`, `frontend/src/stores/session-store.ts`

## Acceptance Criteria

- [ ] MatrixRow内のcomputed()がuseComputed()に置換されている
- [ ] MatrixView内のcomputed()がuseComputed()に置換されている
- [ ] ストアにtodosByProjectId, sessionsByProjectIdのcomputedが追加されている
- [ ] ビルド・型チェック通過

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | computed()はモジュールレベルかuseComputed()で使う |

## Resources

- PR: current branch (master)
- Preact Signals docs: useComputed() usage
