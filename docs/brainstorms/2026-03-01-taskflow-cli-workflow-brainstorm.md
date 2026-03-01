---
topic: taskflow CLIワークフロー統合
date: 2026-03-01
status: decided
---

# Taskflow CLIワークフロー統合

## What We're Building

`/taskflow` スキルに `session` サブコマンドを追加し、Claude Code上でのタスク管理とセッション記録をシームレスにする。

**目的**: 「何をやるか（タスク管理）」と「どこまでやったか（セッション記録）」を CLI から一元管理。

## ユースケース

### パターン1: 既存タスクから始める

```
/taskflow status → タスク一覧 → 「これをやろう」
→ セッション自動作成 + タスクin_progress
→ 前回のセッションログがあれば表示
→ 作業 → /taskflow done → completed + ログ記録
```

### パターン2: 新アイデアから始める

```
/brainstorm → /plan → plan内のTODOからtaskflowにタスク自動作成
→ /work → セッション作成 + 実装 → 完了時にタスク更新
```

### パターン3: 前回の続き

```
/taskflow → 一時停止中セッション表示 → 「再開して」
→ セッション再開 + 前回ログ/コンテキスト復元
```

## Why This Approach

**アプローチ: `/taskflow session` サブコマンド追加**

選定理由:
- 既存スキルの自然な拡張で最もシンプル
- workflow連携は次ステップで段階的に追加可能
- CLAUDE.mdルールのみだと動作が不安定

却下したアプローチ:
- workflowフック方式: compound-engineering内部に依存しすぎ
- CLAUDE.mdルールのみ: 再現性が低い

## Key Decisions

1. **`/taskflow session` サブコマンド群を追加**
   - `session start [タスク検索ワード]` → セッション作成 + タスク紐付け
   - `session end` → セッション終了 + ログ自動記録
   - `session log [メモ]` → 進捗メモ追加
   - 引数なし `/taskflow` で一時停止中セッション表示

2. **タスク管理とセッション管理は独立だが連携可能**
   - セッション開始時にタスクを紐付け可能（任意）
   - セッション終了時にタスクを自動完了にする提案（ユーザー確認あり）

3. **workflow連携は「次のステップ」として段階的に追加**
   - まずsessionサブコマンドを使えるようにする
   - その後、/plan → タスク自動作成、/work → セッション自動開始 を検討

## Open Questions

なし（対話で解決済み）
