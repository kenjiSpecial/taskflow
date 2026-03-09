---
title: システムプロンプト更新 - タスク作成時のセッション・プロジェクト紐付けガイダンス
type: feat
status: completed
date: 2026-03-09
---

# システムプロンプト更新 - タスク作成時のセッション・プロジェクト紐付け

## Overview

Taskflowチャットアシスタントのシステムプロンプトを更新し、タスク作成時にプロジェクトとセッションへの紐付けを能動的に確認・提案する振る舞いを追加する。

現状のプロンプトはシンプルな4行ルールのみで、ViewContextにプロジェクトがある場合に暗黙的にそのプロジェクトへ紐付ける指示があるだけ。セッションリンクの指示は一切ない。

## Problem Statement

- ユーザーが「タスクを追加して」と言うと、プロジェクトやセッションに紐付かない孤立タスクが作成されがち
- 後から手動で紐付ける手間が発生
- 既存プロジェクトとの関連性を考慮せずに作成される

## Proposed Solution

### 変更1: システムプロンプト拡充 (`taskflow-cmux-server.ts`)

`buildSystemPrompt()` に以下のガイダンスを追加：

```
タスク作成のルール:
- タスク作成を依頼されたら、まず以下を確認する（「タスクのみ作成」と言われた場合は省略可）:
  1. プロジェクト紐付け: list_projects で既存プロジェクトを確認し、最も関連性の高いものを提案する
  2. セッション紐付け: 新しいセッションを作成して紐付けるか確認する
- ViewContextにプロジェクトがある場合は、そのプロジェクトを第一候補として提案する
- 確認は簡潔に1回のメッセージで行う（例: 「プロジェクト『X』に紐付けますか？セッションも作成しますか？」）
- ユーザーが「いいえ」「なし」等と答えた場合は紐付けなしで作成する
```

### 変更2: セッション-タスクリンクツール追加 (`agent-tools.ts`)

現状、LLMにはタスクをセッションにリンクするツールがない。以下を追加：

#### `link_task_to_session`
- POST `/api/sessions/:id/tasks`
- パラメータ: `session_id`, `todo_id`

#### `unlink_task_from_session`
- DELETE `/api/sessions/:id/tasks/:todoId`
- パラメータ: `session_id`, `todo_id`

#### `get_session_tasks`
- GET `/api/sessions/:id/tasks`
- パラメータ: `session_id`

### 変更3: toolApiMap への追加 (`agent-tools.ts`)

上記3ツールのAPI呼び出しマッピングを追加。

## Acceptance Criteria

- [x] `buildSystemPrompt()` にタスク作成時のプロジェクト・セッション確認ガイダンスが追加されている
- [x] 「タスクのみ作成」と言った場合は確認をスキップする旨が記述されている
- [x] ViewContextのプロジェクトを第一候補として扱う旨が記述されている
- [x] `link_task_to_session` ツールが `agentTools` に定義されている
- [x] `unlink_task_from_session` ツールが `agentTools` に定義されている
- [x] `get_session_tasks` ツールが `agentTools` に定義されている
- [x] 3ツールの `toolApiMap` マッピングが追加されている
- [x] `unlink_task_from_session` が `destructiveTools` に追加されている

## 対象ファイル

| ファイル | 変更内容 |
|---|---|
| `taskflow-cmux-server.ts` | `buildSystemPrompt()` のプロンプト拡充 |
| `agent-tools.ts` | 3ツール追加 + toolApiMap + destructiveTools |

## Context

- セッション-タスクリンクAPI: `src/routes/sessions.ts:248-312`
- 現在のシステムプロンプト: `taskflow-cmux-server.ts:246-275`
- 現在のツール定義: `agent-tools.ts:1-167`
