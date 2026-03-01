---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, architecture, quality]
dependencies: []
---

# SQL集計クエリの重複

## Problem Statement

`src/routes/projects.ts` 内のプロジェクト一覧・詳細で、todos/sessionsのカウント集計SQLが重複している。DRY原則違反でメンテナンスコストが高い。

## Findings

- Architecture Strategist: Duplicated SQL aggregation query (MEDIUM)
- Code Simplicity Reviewer: Duplicated SQL in projects route

## Proposed Solutions

### Solution A: ヘルパー関数化
- `projectWithCounts()` のようなヘルパー関数をlib/に作成
- Pros: DRY、テスト可能
- Effort: Small
- Risk: Low

## Technical Details

- **Affected files**: `src/routes/projects.ts`, `src/lib/db.ts`

## Acceptance Criteria

- [ ] 集計SQLが1箇所に集約されている
- [ ] 一覧・詳細で同じヘルパーを使用
- [ ] テスト通過

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | |
