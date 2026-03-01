---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, test]
dependencies: []
---

# プロジェクトAPIのテスト追加

## Problem Statement

新規追加されたprojects CRUD APIにテストがない。todos/sessionsには既にテストがある。

## Findings

- Architecture Strategist: No project API tests (LOW)
- 既存テストパターン: `test/todos.test.ts`, `test/sessions.test.ts` を参考にできる

## Proposed Solutions

### Solution A: 既存パターンに倣ってテスト追加
- `test/projects.test.ts` を新規作成
- CRUD全操作 + バリデーション + ソフトデリート + アーカイブをカバー
- Effort: Medium
- Risk: Low

## Technical Details

- **Affected files**: `test/projects.test.ts` (新規)
- **Reference**: `test/todos.test.ts`, `test/sessions.test.ts`

## Acceptance Criteria

- [ ] プロジェクトCRUD全操作のテスト
- [ ] バリデーションエラーケース
- [ ] ソフトデリート動作
- [ ] アーカイブ/アンアーカイブ
- [ ] 全テスト通過

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | |
