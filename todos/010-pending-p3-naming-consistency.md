---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, quality, pattern]
dependencies: []
---

# 命名の一貫性改善

## Problem Statement

コードベース全体でTodo/Taskの用語混在、および一部の変数命名が不明瞭。

## Findings

- Pattern Recognition: Todo vs Task の混在（DBはtodos、UIはTask）
- `doneExpandedProjects` - 「done」が曖昧（セッションdoneなのか完了なのか）
- `window.confirm()` がストア層にある（UI層の責務）

## Proposed Solutions

### Solution A: 命名ルール統一
- DB/API層: todo
- UI層: task（ユーザー向けの用語として）
- `doneExpandedProjects` → `doneSessionExpandedProjects`
- `window.confirm()` をコンポーネント側に移動
- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] 命名規則がCLAUDE.mdに記載
- [ ] doneExpandedProjectsがリネーム
- [ ] window.confirm()がストア層から除去

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | |
