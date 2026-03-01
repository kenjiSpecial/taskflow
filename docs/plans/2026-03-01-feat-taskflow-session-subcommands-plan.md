---
title: "feat: /taskflow sessionサブコマンド追加"
type: feat
status: completed
date: 2026-03-01
brainstorm: docs/brainstorms/2026-03-01-taskflow-cli-workflow-brainstorm.md
---

# feat: /taskflow sessionサブコマンド追加

## Overview

`/taskflow` スキルに `session start/end/log` サブコマンドを追加し、Claude Code CLIからセッション管理をシームレスに行えるようにする。

**変更対象**: SKILL.mdのみ（バックエンドAPI・フロントエンドは変更なし。全API実装済み）

## 設計原則

- **active同時1件制約**: 一度にactiveなセッションは1つまで。startで既存activeはpaused提案
- **タスクリンクは任意**: セッション単独でも、タスク紐付きでも使える
- **ログソース**: CLIからのログは `source: "cli"` で記録

## 既存サブコマンドとの整理

| 旧（廃止） | 新（統合後） | 備考 |
|-----------|------------|------|
| - | `session start` | 新規。セッション作成 + タスクリンク + in_progress |
| - | `session end` | 新規。セッション終了 + 自動ログ + タスク完了提案 |
| - | `session log` | 新規。現在のactiveセッションにログ追加 |
| - | `session pause` | 新規。activeセッションを一時停止 |
| - | `session resume` | 新規。pausedセッションを再開 |
| - | `session list` | 新規。active+pausedセッション一覧 |

既存の `add/done/update/delete/status/context` はそのまま維持。

## サブコマンド仕様

### 7. `/taskflow session start [タスク検索ワード]` — セッション開始

**タスク検索ワードありの場合:**

1. `GET /api/todos?status=pending&status=in_progress` でタスク一覧取得
2. タイトルに検索ワードを含むものをフィルタ
3. 0件: 「該当タスクが見つかりません」+ pending/in_progressタスク一覧表示
4. 1件: 確認表示
5. 複数件: AskUserQuestionで選択
6. `GET /api/sessions?status=active` で既存activeセッション確認
   - active存在: 「『{title}』がactive中です。pausedにしますか？」→ yes: `PATCH status=paused`
7. `POST /api/sessions` でセッション作成（title = タスクタイトル、project = タスクのproject）
8. `POST /api/sessions/:id/tasks` でタスク紐付け
9. `PATCH /api/todos/:id` で `{status: "in_progress"}` に更新
10. 同タスクに過去セッションがあれば `GET /api/todos/:id/sessions` で前回ログ表示

**タスク検索ワードなしの場合:**

1. AskUserQuestionでセッションタイトルを入力
2. AskUserQuestionでプロジェクト選択（`GET /api/projects` から候補表示 + 新規 + スキップ）
3. 既存activeセッション確認（上記と同じ）
4. `POST /api/sessions` でセッション作成
5. 「タスクを紐付けますか？」→ yes: pending/in_progressタスク一覧から選択 → リンク

**出力例:**
```
🔄 セッション開始: 「セッション管理UIの改善」 (taskflow)
   紐付けタスク: [高] セッション管理UIの改善 → 進行中に変更

📝 前回のログ (02/28):
   - APIエンドポイント実装完了、次はUI側
```

### 8. `/taskflow session end` — セッション終了

1. `GET /api/sessions?status=active` + `GET /api/sessions?status=paused` で対象セッション検索
   - 0件: 「終了できるセッションがありません」
   - active 1件: そのセッションを対象
   - active複数 or activeなし+paused複数: AskUserQuestionで選択
2. 自動ログ生成:
   - `git log --oneline -5` + `git diff --stat` から作業サマリーを生成
   - git情報がなければ「セッション終了」のみ
3. AskUserQuestion: 「ログに追記したいことはありますか？」→ 入力があれば追記
4. `POST /api/sessions/:id/logs` でログ追加（`source: "cli"`）
5. `PATCH /api/sessions/:id` で `{status: "done"}` に更新
6. `GET /api/sessions/:id/tasks` でリンク済みタスク確認
   - 未完了タスクあり: AskUserQuestion「以下のタスクを完了にしますか？」（multiSelect）
   - 選択されたタスクを `PATCH /api/todos/:id` で `{status: "completed"}` に更新
7. 結果表示

**出力例:**
```
✅ セッション終了: 「セッション管理UIの改善」
   ログ: APIエンドポイント実装完了 + UI側の表示修正
   タスク完了: [高] セッション管理UIの改善
```

### 9. `/taskflow session log [メモ]` — ログ追加

1. `GET /api/sessions?status=active` で対象セッション特定
   - 0件: 「アクティブなセッションがありません。`/taskflow session start` で開始してください」
   - 1件: そのセッション
   - 複数件: AskUserQuestionで選択
2. メモ引数あり: そのまま使用
3. メモ引数なし: AskUserQuestionでメモ入力を求める
4. `POST /api/sessions/:id/logs` で `{content: メモ, source: "cli"}` 送信
5. 結果表示

### 10. `/taskflow session pause` — 一時停止

1. `GET /api/sessions?status=active` でactiveセッション取得
   - 0件: 「アクティブなセッションがありません」
   - 1件: そのセッション
   - 複数件: AskUserQuestionで選択
2. `PATCH /api/sessions/:id` で `{status: "paused"}` に更新
3. 結果表示

### 11. `/taskflow session resume [検索ワード]` — 再開

1. `GET /api/sessions?status=paused` でpausedセッション取得
2. 検索ワードあり: タイトル部分一致フィルタ
3. 0件: 「一時停止中のセッションがありません」
4. 1件: そのセッション
5. 複数件: AskUserQuestionで選択
6. 既存activeセッション確認 → あれば paused提案（session startと同じ）
7. `PATCH /api/sessions/:id` で `{status: "active"}` に更新
8. 最新ログ3件を表示（コンテキスト復帰用）

### 12. `/taskflow session list` — セッション一覧

1. `GET /api/sessions?status=active` + `GET /api/sessions?status=paused` を並列取得
2. 一覧表示

**出力例:**
```
## 🔄 アクティブセッション (1件)
- 「セッション管理UIの改善」 (taskflow) - タスク: 2/3完了 - 最終更新: 03/01 14:30

## ⏸ 一時停止中 (1件)
- 「ダークモード対応」 (taskflow) - タスク: 0/2完了 - 最終更新: 02/28 18:00
```

## `/taskflow` 引数なし・`/taskflow status` の拡張

### 引数なし (`/taskflow`)

現在: `/taskflow status` と同じ動作

変更後: 既存のステータス表示に加え、以下を先頭に追加:

```
## 🔄 進行中のセッション
- 「セッション管理UIの改善」 (taskflow) - タスク: 2/3完了

## ⏸ 一時停止中のセッション (1件)
- 「ダークモード対応」 → 再開: `/taskflow session resume ダーク`

---
（以下、既存のタスクステータス表示）
```

activeがない場合はセッションセクションを非表示。pausedがあればリマインド表示。

### `/taskflow status`

同上（`/taskflow` と同じ拡張）。

## エラーハンドリング

| 状況 | 対応 |
|------|------|
| doneセッションへのログ追加 (403) | 「完了済みセッションです。再開するには `/taskflow session resume`」 |
| タスクリンク重複 (409) | 「すでにリンク済みです」（エラーにせず続行） |
| セッション作成後のタスクリンク失敗 | セッションは作成済みとして残す。エラーメッセージ表示 |
| session end後のタスク完了失敗 | セッションはdone済み。エラーメッセージ表示 + 手動対応を案内 |
| API接続エラー | リトライ提案 |

## Acceptance Criteria

- [x] SKILL.md に `session start/end/log/pause/resume/list` の6サブコマンドを追加
- [x] `/taskflow` 引数なし時にactive/pausedセッション情報を表示
- [x] `session start` でタスク検索→セッション作成→タスクリンク→in_progress更新が一連で動作
- [x] `session end` で自動ログ生成→セッション終了→タスク完了提案が一連で動作
- [x] `session log` で現在のactiveセッションにCLIログ追加可能
- [x] active同時1件制約（start/resume時に既存activeをpaused提案）
- [x] 全エラーケースで日本語エラーメッセージ表示

## 実装手順

1. 既存SKILL.mdのバックアップ確認（`~/.claude/backups/taskflow-20260227/`）
2. SKILL.mdの APIエンドポイント一覧にセッション系を追加
3. サブコマンド7-12を追加
4. 引数なし / status の出力フォーマット更新
5. スキルの description を更新（セッション管理を含める）
6. 動作テスト（各サブコマンドを手動実行）

## References

- ブレインストーム: `docs/brainstorms/2026-03-01-taskflow-cli-workflow-brainstorm.md`
- セッションAPI実装: `src/routes/sessions.ts`
- バリデーション: `src/validators/session.ts`
- 既存SKILL.md: `~/.claude/backups/taskflow-20260227/SKILL.md`
- ヘルパースクリプト: `~/.claude/backups/taskflow-20260227/scripts/taskflow-api.sh`
