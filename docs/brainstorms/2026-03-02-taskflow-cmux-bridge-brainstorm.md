# Taskflow-cmux ブリッジ

**日付**: 2026-03-02
**ステータス**: ブレインストーム完了

## 何を作るか

Taskflowのセッション/タスクとcmuxのワークスペースを双方向で連動させるCLIブリッジツール `taskflow-cmux`。

- **Taskflow → cmux**: セッション開始でworkspace作成、サイドバーにタスク進捗・一覧表示
- **cmux → Taskflow**: workspace閉じたらセッション完了、作業ログの自動記録

## なぜこのアプローチか

- **CLIブリッジ（Shell Script）**: 既存のTaskflow API + cmux CLIを橋渡しするだけ。依存が少なく、段階的に拡張可能
- **ローカルファイルでマッピング管理**: DB変更不要、マイグレーション不要。`~/.taskflow-cmux/mappings.json`
- **1セッション = 1 Workspace**: 概念が自然に対応。セッションの状態とworkspaceのライフサイクルが1:1

## コンセプトマッピング

```
Taskflow                 cmux
────────────────────     ────────────────────
セッション (active)   →  Workspace (タブ)
セッション (paused)   →  Workspace + status pill "paused"
セッション (done)     →  Workspace 閉じる
タスク進捗            →  sidebar progress bar
タスク一覧            →  sidebar log entries
タスク完了            →  cmux notification
```

## 主要コマンド

```bash
# セッション開始 → workspace作成 + サイドバー設定
taskflow-cmux start <session-id>

# セッション一覧の同期（active/pausedセッションのworkspace状態を更新）
taskflow-cmux sync

# 特定セッションのサイドバー情報を更新
taskflow-cmux update <session-id>

# workspace閉じる → セッションdone化
taskflow-cmux stop <session-id>

# マッピング状態の確認
taskflow-cmux status
```

## データフロー

### start コマンド

```
1. Taskflow API: GET /api/sessions/:id → セッション情報取得
2. Taskflow API: GET /api/sessions/:id/tasks → リンク済みタスク取得
3. cmux CLI: new-workspace → workspace作成、IDを取得
4. cmux CLI: set-status → セッション状態をstatus pillに表示
5. cmux CLI: set-progress → タスク完了率をprogress barに表示
6. cmux CLI: log → タスクタイトル一覧をsidebarログに表示
7. ローカル: mappings.json に session_id ↔ workspace_id を保存
```

### sync コマンド

```
1. Taskflow API: GET /api/sessions?status=active,paused → アクティブセッション一覧
2. mappings.json から既存マッピングを読み込み
3. 各セッションについて:
   a. workspace存在チェック (cmux list-workspaces)
   b. タスク進捗更新 (set-progress)
   c. ステータス更新 (set-status)
   d. workspaceが閉じられていたら → Taskflow API: PATCH /api/sessions/:id {status: "done"}
```

### stop コマンド

```
1. mappings.json からworkspace IDを取得
2. cmux CLI: close-workspace
3. Taskflow API: PATCH /api/sessions/:id {status: "done"}
4. mappings.json からマッピング削除
```

## マッピングファイル

```json
// ~/.taskflow-cmux/mappings.json
{
  "mappings": [
    {
      "session_id": "abc123",
      "workspace_id": "ws-456",
      "created_at": "2026-03-02T10:00:00Z"
    }
  ]
}
```

## cmuxサイドバー表示イメージ

```
┌─ Workspace: "API認証リファクタ" ─────┐
│                                       │
│  ● active                             │  ← status pill (green)
│  ████████░░ 3/5 tasks                 │  ← progress bar
│                                       │
│  Logs:                                │
│  ✓ Bearer Token実装                   │  ← completed task
│  ✓ テスト修正                         │  ← completed task
│  ✓ CORSミドルウェア更新              │  ← completed task
│  ○ APIドキュメント更新               │  ← pending task
│  ○ デプロイ                          │  ← pending task
└───────────────────────────────────────┘
```

## 技術詳細

### 前提条件
- cmux がインストール済み（`brew install --cask cmux`）
- jq がインストール済み
- Taskflow API にアクセス可能（Bearer Token設定済み）

### 設定
- 環境変数を優先: `TASKFLOW_API_URL`, `TASKFLOW_API_TOKEN`
- 未設定なら `~/.taskflow-cmux/config.json` にフォールバック

### ファイル構成
```
taskflow-cmux           # メインスクリプト (bash)
~/.taskflow-cmux/
  config.json           # API URL, Token（環境変数未設定時のフォールバック）
  mappings.json         # session ↔ workspace マッピング
```

### cmux Socket API 利用
- Socket: `/tmp/cmux.sock`
- 環境変数 `CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID` を活用
- CLI: `cmux new-workspace`, `cmux set-progress`, `cmux set-status`, `cmux log` 等

## 段階的実装計画

### Phase 1: 基本連携
- `start`: セッション → workspace作成 + サイドバー基本表示
- `stop`: workspace閉じる → セッションdone
- `status`: マッピング状態確認

### Phase 2: 同期・更新
- `sync`: 全アクティブセッションの状態同期
- `update`: 個別セッションのサイドバー更新
- workspace消失検知 → 自動done化

### Phase 3: 拡張
- cmuxフック連携（workspace closedイベント → 自動stop）
- タスク完了時のcmux notification
- セッションログへの自動記録（作業時間等）

## 決定事項

1. **実装形態**: Shell Script CLIブリッジ
2. **マッピング粒度**: 1セッション = 1 Workspace
3. **マッピング保存先**: ローカルファイル (`~/.taskflow-cmux/`)
4. **サイドバー表示**: タスク進捗 + ステータス + タスク一覧
5. **実装言語**: Bash（jq + curl + cmux CLI）
6. **設定管理**: 環境変数優先、config.jsonフォールバック
7. **sync実行**: 手動のみ（cron/launchd不要）
8. **ディレクトリ連携**: 不要（デフォルトで開く）

## 解決済みの質問

1. **configの管理方法** → 環境変数（`TASKFLOW_API_URL`, `TASKFLOW_API_TOKEN`）優先。未設定時は `~/.taskflow-cmux/config.json` にフォールバック
2. **sync の実行タイミング** → 手動実行のみ。必要なときに `taskflow-cmux sync` を手動で実行
3. **workspace作成時のディレクトリ** → 不要。デフォルトディレクトリで開く。必要になったら後で追加
