---
title: "feat: Taskflow-cmux ブリッジ CLI"
type: feat
status: completed
date: 2026-03-02
brainstorm: docs/brainstorms/2026-03-02-taskflow-cmux-bridge-brainstorm.md
---

# feat: Taskflow-cmux ブリッジ CLI

## Overview

Taskflowのセッション/タスクとcmuxのワークスペースを双方向連携するBash CLIツール `taskflow-cmux`。セッション開始でcmux workspaceを自動作成し、サイドバーにタスク進捗を表示。workspace閉鎖でセッションを自動完了。

## Proposed Solution

Bash + jq + curl + cmux CLI で構成される単一スクリプト。Taskflow REST APIとcmux Socket APIをブリッジする。

### コンセプトマッピング

```
Taskflow                 cmux
────────────────────     ────────────────────
セッション (active)   →  Workspace (タブ)
セッション (paused)   →  Workspace + status pill "paused"
セッション (done)     →  Workspace 閉じる
タスク進捗            →  sidebar progress bar
タスク一覧            →  sidebar log entries
```

## Technical Approach

### Architecture

```
┌─────────────────┐     curl      ┌──────────────┐
│  taskflow-cmux  │ ─────────────→│ Taskflow API │
│  (Bash script)  │               │ (Workers)    │
│                 │     cmux CLI  ├──────────────┤
│                 │ ─────────────→│ cmux Socket  │
│                 │               │ (/tmp/cmux   │
│  ~/.taskflow-   │               │  .sock)      │
│  cmux/          │               └──────────────┘
│  mappings.json  │
└─────────────────┘
```

### 設定管理

環境変数を優先、config.jsonにフォールバック:

```bash
# 環境変数（優先）
TASKFLOW_API_URL    # default: https://taskflow.kenji-draemon.workers.dev
TASKFLOW_API_TOKEN  # required

# フォールバック
~/.taskflow-cmux/config.json
```

### Implementation Phases

#### Phase 1: 基本連携（MVP）

5つのサブコマンドを実装。

##### 1-1. 共通基盤

**ファイル**: `taskflow-cmux`

```bash
#!/usr/bin/env bash
set -euo pipefail
```

共通関数:
- `load_config`: ENV → config.json フォールバックで設定読み込み
- `check_deps`: cmux, jq, curl の存在確認
- `api_get`, `api_patch`: Taskflow API呼び出しヘルパー（HTTPステータスチェック付き）
- `read_mappings`, `write_mappings`: mappings.json の読み書き（初回自動作成）
- `find_session_mapping`: session_idからworkspace_idを検索
- `die`: エラーメッセージをstderrに出力して exit 1
- `log_info`, `log_success`, `log_warn`: 色付きメッセージ出力

ディレクトリ・ファイル自動初期化:
- `~/.taskflow-cmux/` が存在しなければ作成
- `mappings.json` が存在しなければ `{"mappings":[]}` で作成
- `config.json` が存在しパーミッションが600でなければ警告

##### 1-2. `start <session-id>` コマンド

```
フロー:
1. check_deps
2. load_config
3. session-id のプレフィックスマッチ解決（後述）
4. 重複チェック: mappings.json に既にsession_idがあればエラー終了
5. API: GET /api/sessions/:id → セッション情報取得
   - 404 → "セッションが見つかりません" でエラー
   - status == "done" → "セッションは完了済みです" でエラー
6. API: GET /api/sessions/:id/tasks → リンク済みタスク取得
7. cmux new-workspace → workspace作成、--json でID取得
   - workspace名にセッションtitleを使用
8. cmux set-status --key taskflow --icon ● --color green
   (paused の場合は --color yellow)
9. タスクがある場合:
   a. cmux set-progress --label "N/M tasks" --value 0.X
   b. 各タスクについて cmux log で表示:
      - completed: "✓ <title>" (level: success)
      - pending/in_progress: "○ <title>" (level: info)
10. mappings.json に追記: {session_id, workspace_id, created_at}
11. 成功メッセージ出力
```

##### 1-3. `stop <session-id>` コマンド

```
フロー:
1. check_deps, load_config
2. mappings.json からsession_id → workspace_id を検索
   - 見つからない → "マッピングが見つかりません" でエラー
3. API: PATCH /api/sessions/:id {status: "done"}
   - 失敗 → エラー（workspaceは閉じない = 安全側に倒す）
4. cmux close-workspace --workspace <workspace_id>
   - 失敗しても続行（既に閉じられている可能性）
5. mappings.json からマッピング削除
6. 成功メッセージ出力
```

**操作順序の根拠**: API PATCH を先に行う。理由: workspaceを閉じた後にAPI PATCHが失敗すると、ユーザーはworkspaceもセッションも失った状態になり復旧困難。API PATCHを先に行えば、失敗時はworkspaceがまだ残っており、再試行可能。

##### 1-4. `status` コマンド

```
フロー:
1. mappings.json 読み込み
2. マッピングが空 → "アクティブなマッピングはありません" と表示
3. 各マッピングを表形式で表示:
   SESSION_ID (先頭8文字)  |  WORKSPACE_ID  |  CREATED_AT
4. 合計件数を表示
```

##### 1-5. `sync` コマンド

```
フロー:
1. check_deps, load_config
2. API: GET /api/sessions?status=active （1回目）
3. API: GET /api/sessions?status=paused （2回目）
   ※ APIが単一statusしか受けないため2回呼ぶ
4. 結果をマージしてアクティブセッション一覧を作成
5. cmux list-workspaces --json → 現在のworkspace一覧
6. mappings.json 読み込み
7. 各マッピングについて:
   a. workspaceが存在しない場合:
      → API: PATCH /api/sessions/:id {status: "done"}
      → マッピング削除
      → "セッション X: workspace消失 → done化"
   b. セッションがAPI側でdone/削除済みの場合:
      → cmux close-workspace
      → マッピング削除
      → "セッション X: API側で完了 → workspace閉鎖"
   c. 両方存在する場合:
      → API: GET /api/sessions/:id/tasks
      → cmux set-progress 更新
      → cmux set-status 更新
      → cmux clear-log + 各タスクを cmux log で再表示
      → "セッション X: 同期完了"
8. マッピングにないがAPI上でactiveなセッション:
   → 警告: "セッション X はworkspaceがありません。taskflow-cmux start X で作成してください"
9. 結果サマリ出力
```

##### 1-6. `update <session-id>` コマンド

```
フロー:
1. check_deps, load_config
2. mappings.json からworkspace_id取得
   - 見つからない → エラー
3. API: GET /api/sessions/:id
4. API: GET /api/sessions/:id/tasks
5. cmux set-status 更新
6. cmux set-progress 更新
7. cmux clear-log + 各タスクを cmux log で再表示
8. 成功メッセージ
```

##### 1-7. session-id プレフィックスマッチ

UX向上のため、session-idの先頭数文字での指定を許可:

```bash
# 完全ID
taskflow-cmux start abc123def456...

# プレフィックス（4文字以上）
taskflow-cmux start abc1

# 一意に特定できない場合は候補を表示してエラー
```

実装: mappings.json のマッピング一覧（stop/update/status用）、またはAPI検索結果（start用）からプレフィックスマッチ。

##### 1-8. ヘルプ・usage

```
Usage: taskflow-cmux <command> [args]

Commands:
  start <session-id>   セッションのworkspaceを作成
  stop <session-id>    workspaceを閉じてセッションを完了
  update <session-id>  サイドバー情報を更新
  sync                 全アクティブセッションの状態を同期
  status               マッピング状態を表示

Environment:
  TASKFLOW_API_URL     API URL (default: https://taskflow.kenji-draemon.workers.dev)
  TASKFLOW_API_TOKEN   API Token (required)
  TASKFLOW_CMUX_DEBUG  デバッグモード (1 で有効)

Config: ~/.taskflow-cmux/config.json
```

#### Phase 2: 拡張（Phase 1安定後）

- cmuxフック連携（workspace closedイベント → 自動stop）
- タスク完了時のcmux notification (`cmux notify`)
- セッションログへの自動記録（`source: "cli"`）
- `--json` 出力オプション

### エラーハンドリングポリシー

全コマンド共通:

| エラー種別 | 対応 | exit code |
|---|---|---|
| 前提コマンド不足 | "cmux/jq/curl が見つかりません" → exit 1 | 1 |
| API認証失敗 (401) | "API認証に失敗しました。TASKFLOW_API_TOKEN を確認してください" | 1 |
| リソース不在 (404) | "セッションが見つかりません: <id>" | 1 |
| APIサーバーエラー (5xx) | "APIサーバーエラー: <status>" | 1 |
| ネットワークエラー | "APIに接続できません: <url>" | 1 |
| cmuxコマンド失敗 | エラー内容を表示 → exit 1 | 1 |
| mappings.json破損 | "mappings.jsonが不正です。削除して再作成してください" | 1 |
| 重複start | "セッション X は既にworkspaceに紐づいています" | 1 |
| doneセッションへのstart | "セッションは完了済みです" | 1 |

デバッグモード (`TASKFLOW_CMUX_DEBUG=1`):
- curl呼び出しの完全なリクエスト/レスポンスを表示
- cmuxコマンドの実行内容を表示

## Acceptance Criteria

### Phase 1: 基本連携

- [x] `taskflow-cmux start <session-id>` でcmux workspaceが作成される
- [x] workspaceのサイドバーにstatus pill、progress bar、タスク一覧が表示される
- [x] `taskflow-cmux stop <session-id>` でworkspaceが閉じ、セッションがdoneになる
- [x] `taskflow-cmux sync` でマッピング状態が同期される（workspace消失→done化、API側done→workspace閉鎖）
- [x] `taskflow-cmux update <session-id>` でサイドバー情報が最新化される
- [x] `taskflow-cmux status` でマッピング一覧が表示される
- [x] 環境変数 → config.json フォールバックで設定が読み込まれる
- [x] 前提コマンド (cmux, jq, curl) の存在チェックが行われる
- [x] エラー時に適切なメッセージとexit code 1が返される
- [x] session-idプレフィックスマッチが動作する
- [x] 引数なし・不正コマンドでusageが表示される
- [x] 重複start、doneセッションへのstartが拒否される

### ファイル構成

```
taskflow-cmux                    # メインBashスクリプト（実行可能）
```

ランタイム生成:
```
~/.taskflow-cmux/
  config.json                    # 設定（環境変数未設定時のフォールバック）
  mappings.json                  # session_id ↔ workspace_id マッピング
```

## Dependencies & Risks

### 依存

- **cmux CLI**: Socket API (`/tmp/cmux.sock`) 経由でworkspace操作。cmuxの破壊的変更に弱い
- **Taskflow API**: セッション・タスクのREST API。Bearer Token認証
- **jq**: JSONパース
- **curl**: HTTP通信

### リスク

| リスク | 影響 | 緩和策 |
|---|---|---|
| cmux CLIの仕様変更 | コマンドが動作しなくなる | cmuxバージョンチェック、最小限のAPI利用 |
| mappings.jsonの不整合 | 孤立workspace/セッション | sync コマンドで定期的に修復 |
| API認証トークンの平文保存 | セキュリティリスク | ファイルパーミッション600警告 |
| ネットワーク切断中の操作 | 部分的失敗 | API操作を先に行い、失敗時はworkspaceを残す |

## References & Research

### Internal References

- ブレインストーム: `docs/brainstorms/2026-03-02-taskflow-cmux-bridge-brainstorm.md`
- セッションAPI: `src/routes/sessions.ts`
- セッションバリデータ: `src/validators/session.ts`
- 認証ミドルウェア: `src/middleware/auth.ts`
- 既存CLIスキル: `docs/plans/2026-03-01-feat-taskflow-session-subcommands-plan.md`

### External References

- cmux公式ドキュメント: https://www.cmux.dev/docs/api
- cmux Concepts: https://www.cmux.dev/docs/concepts
- cmux GitHub: https://github.com/manaflow-ai/cmux
