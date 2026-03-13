---
title: "feat: メニューバーにセッション・ワークスペース表示を追加"
type: feat
status: completed
date: 2026-03-10
---

# feat: メニューバーにセッション・ワークスペース表示を追加

## Overview

メニューバーアプリのメインパネルを改善。アクティブセッションをプロジェクト別にグループ化して最上部に表示し、cmuxワークスペースの開く/完了操作をネイティブで実行できるようにする。

## Acceptance Criteria

- [x] 表示順序: セッション（プロジェクト別） → 今日のタスク → 進行中タスク
- [x] セッションはプロジェクト名でグループ化（project nullは「その他」）
- [x] WS開いているセッションがグループ内で上にソート
- [x] 各セッション行に「開く」ボタン（WS未作成時は作成）
- [x] 各セッション行に「完了」ボタン
- [x] `~/.taskflow-cmux/mappings.json` を読んでWS状態を判定
- [x] `taskflow-cmux start/stop` をProcess直接実行
- [x] 操作中はローディング表示、エラー時はインラインエラー

## Technical Approach

### データフロー

```
AppState.refreshData()
  ├── API: GET /api/sessions?status=active  → activeSessions
  ├── API: GET /api/todos/today             → todayTodos
  ├── API: GET /api/todos?status=in_progress → inProgressTodos
  └── File: ~/.taskflow-cmux/mappings.json  → workspaceMappings
```

### UIレイアウト

```
┌─────────────────────────────────┐
│ TaskFlow                    ⟳ ⚙ │
├─────────────────────────────────┤
│ ■ taskflow                      │  ← プロジェクト名（色付き）
│   OpenClaw認証リファクタ 2/5 [▶]│  ← WS開: ▶で切替
│   APIテスト           0/3 [＋]  │  ← WS未: ＋で作成
│                                 │
│ ■ その他                        │  ← project null
│   雑務セッション      1/1 [＋]  │
│                                 │
│ 📅 今日のタスク                  │
│   ● セッション検索機能の追加     │
│                                 │
│ ▶ 進行中                        │
│   (なし)                        │
├─────────────────────────────────┤
│ Taskflowを開く / FE起動     ⚙   │
└─────────────────────────────────┘
```

セッション行の操作:
- **行タップ**: WS存在時 → フォーカス、WS未存在時 → 作成
- **完了**: 行末の × ボタン → 確認なしで `taskflow-cmux stop` 実行

### cmux操作（Process直接実行）

```swift
// 開く/作成
Process: /bin/zsh -l -c "taskflow-cmux start <session-id>"

// 完了
Process: /bin/zsh -l -c "taskflow-cmux stop <session-id>"
```

### mappings.json読み取り

```swift
// ~/.taskflow-cmux/mappings.json
struct CmuxMappings: Codable {
    let mappings: [CmuxMapping]
}
struct CmuxMapping: Codable {
    let sessionId: String    // session_id
    let workspaceId: String  // workspace_id
    let createdAt: String    // created_at
}
// FileManagerで直接読み取り、refreshData時に再読み込み
```

## 実装ステップ

### Phase 1: データ層

- [x] `CmuxMapping` モデル作成 (`macos-menubar/TaskFlowBar/Models/CmuxMapping.swift`)
- [x] `WorkspaceManager` サービス作成 (`macos-menubar/TaskFlowBar/Services/WorkspaceManager.swift`)
  - `loadMappings()`: mappings.json読み取り
  - `hasWorkspace(sessionId:) -> Bool`: WS存在判定
  - `openWorkspace(sessionId:)`: `taskflow-cmux start` 実行
  - `stopSession(sessionId:)`: `taskflow-cmux stop` 実行
- [x] `AppState` に `workspaceManager` を追加
- [x] `refreshData()` で mappings も読み込み

### Phase 2: UI

- [x] `MainPanelView` のセクション順序を変更（セッション → タスク）
- [x] セッションをプロジェクト別にグループ化するロジック追加
- [x] `ProjectSessionGroup` ビュー作成（プロジェクトヘッダー + セッション行）
- [x] `SessionRow` をインタラクティブに改修
  - WS状態アイコン（開/未）
  - 開く/作成ボタン
  - 完了ボタン（×）
  - 操作中ローディング
- [x] WS開セッションをグループ内で上にソート

### Phase 3: エラーハンドリング・仕上げ

- [x] Process実行失敗時のインラインエラー表示
- [x] `taskflow-cmux` 未インストール時のフォールバック
- [x] 操作後のmappings再読み込み
- [x] ビルド・動作確認

## Edge Cases

| ケース | 対応 |
|--------|------|
| session.project が null | 「その他」グループに表示 |
| mappings.json が存在しない | 全セッションWS未作成として表示 |
| taskflow-cmux 未インストール | ボタンdisable、エラーメッセージ |
| stale mapping（WSは閉じたがmapping残り） | `taskflow-cmux start` が内部で処理 |
| 操作中に別の操作 | セッション単位でloading状態管理 |
| paused セッション | 表示しない（active のみ） |

## Swift モデル変更

### `Project.swift` に `directoryPath` 追加（将来用）

```swift
let directoryPath: String?
// CodingKeys: case directoryPath = "directory_path"
```

※ 今回はセッションの `project` フィールド（文字列）でグループ化するため、プロジェクト詳細のフェッチは不要。

## References

- ブレスト: `docs/brainstorms/2026-03-10-menubar-session-workspace-brainstorm.md`
- MainPanelView: `macos-menubar/TaskFlowBar/Views/MainPanelView.swift`
- AppState: `macos-menubar/TaskFlowBar/Stores/AppState.swift`
- taskflow-cmux CLI: `taskflow-cmux` (start: L326, stop: L455)
- mappings.json: `~/.taskflow-cmux/mappings.json`
- Session API: `src/routes/sessions.ts`
