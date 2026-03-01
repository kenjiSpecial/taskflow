---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, architecture, tech-debt]
dependencies: []
---

# レガシーproject文字列フィールドの廃止計画

## Problem Statement

todosとwork_sessionsに `project` (文字列) と `project_id` (FK) の2フィールドが共存。マイグレーション0004でデータ移行済みだが、古いフィールドが残っている。

## Findings

- Architecture Strategist: Dual project/project_id fields (HIGH)
- Code Simplicity Reviewer: Legacy project string field

## Proposed Solutions

### Solution A: 段階的廃止
1. APIからproject文字列フィールドのサポートを削除
2. マイグレーションでカラム削除（将来）
- Effort: Medium
- Risk: Medium（既存データ依存の確認必要）

### Solution B: 現状維持
- 両フィールド共存のまま
- project_idを優先使用
- Effort: None

## Recommended Action

Solution A を次のイテレーションで。現時点ではproject_id優先で動作している。

## Acceptance Criteria

- [ ] APIがproject文字列を受け付けなくなっている
- [ ] フロントエンドがproject_idのみ使用
- [ ] マイグレーションでカラム削除

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | |
