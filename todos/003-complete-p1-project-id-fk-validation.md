---
status: complete
priority: p1
issue_id: "003"
tags: [code-review, security, data-integrity]
dependencies: []
---

# project_id外部キー存在チェック不足

## Problem Statement

todos/sessionsのCREATE/UPDATE時にproject_idの値が実在するプロジェクトかチェックしていない。D1のFKは制約としてサポートが限定的で、存在しないproject_idが設定可能。

## Findings

- Security Sentinel: project_id FK existence check missing (MEDIUM)
- D1はSQLite互換だがFK enforceが不完全な場合がある

## Proposed Solutions

### Solution A: バリデーション関数追加
- todo/session作成・更新時にprojects テーブルをSELECTして存在確認
- Pros: 確実、シンプル
- Cons: 追加クエリ1回
- Effort: Small
- Risk: Low

## Technical Details

- **Affected files**: `src/routes/todos.ts`, `src/routes/sessions.ts`

## Acceptance Criteria

- [ ] project_id指定時にprojectsテーブルで存在確認
- [ ] 存在しない場合400エラーを返す
- [ ] テストで不正project_idのケースをカバー

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | D1のFK制約に頼らず明示的バリデーション |
