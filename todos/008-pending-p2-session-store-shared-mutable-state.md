---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, architecture]
dependencies: []
---

# session-storeの共有ミュータブルシングルトン問題

## Problem Statement

`session-store.ts`の`sessionLogs`と`linkedTasks`がモジュールレベルのsignalで、特定セッションのデータを共有変数に格納。複数セッションを同時展開する場合にデータ混在のリスク。

## Findings

- Architecture Strategist: Shared mutable singleton for sessionLogs/linkedTasks (HIGH)
- 現在はexpandedSessionIdで1つだけ展開なので実害なしだが、今後の拡張で問題化する可能性

## Proposed Solutions

### Solution A: セッションIDをキーにしたMap
- `sessionLogs` を `Map<sessionId, Log[]>` 形式に変更
- Pros: 複数セッション対応可能
- Effort: Medium
- Risk: Low

### Solution B: 現状維持（コメント追記）
- 1セッションのみ展開の制約をコメントで明示
- Pros: 変更不要
- Effort: None
- Risk: 将来問題

## Recommended Action

Solution B（YAGNI）。現時点では1セッション展開の制約で問題なし。

## Acceptance Criteria

- [ ] 制約がコメントとして明示されている、または Map形式に変更されている

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Code review で発見 | |
