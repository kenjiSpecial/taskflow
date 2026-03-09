---
title: macOSメニューバーアプリ
type: feat
status: active
date: 2026-03-09
---

# macOSメニューバーアプリ (TaskFlowBar)

## Overview

macOSメニューバーに常駐するSwiftネイティブアプリ。タスクのクイック確認、WebSocketリアルタイム通知、ブラウザでのWebアプリ起動を提供する。

## Technical Approach

### Architecture

```
TaskFlowBar (Swift/SwiftUI)
  ├── MenuBarExtra (.window style) ← メニューバー常駐
  ├── APIClient (actor) ← REST API通信
  ├── WebSocketClient ← wss://taskflow.../api/realtime
  ├── NotificationManager ← UNUserNotificationCenter
  ├── HotKeyManager ← Cmd+Shift+T
  └── SMAppService ← Login Items
```

**macOSターゲット**: macOS 14+ (Sonoma) — `@Observable`, `MenuBarExtra`, `SMAppService` がすべて利用可能

**Dockアイコン非表示**: `Info.plist` の `LSUIElement = YES`

### API通信

- **REST API**: `https://taskflow.kenji-draemon.workers.dev`
- **認証**: `Authorization: Bearer {token}`
- **WebSocket**: `wss://taskflow.kenji-draemon.workers.dev/api/realtime?token={token}&client_id={client_id}`

### WebSocket メッセージ形式

```json
// サーバー → クライアント: invalidation
{
  "type": "invalidate",
  "resources": ["todos", "sessions"],
  "reason": "todo_updated",
  "origin_client_id": "uuid",
  "occurred_at": "2026-03-09T12:00:00Z"
}
```

**リソース種別**: `projects`, `todos`, `sessions`, `tags`, `session_logs`, `session_tasks`

### 主要エンドポイント

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/todos/today?timezone=Asia/Tokyo` | 今日のタスク |
| GET | `/api/todos?status=in_progress` | 進行中タスク |
| GET | `/api/sessions?status=active` | アクティブセッション |
| GET | `/api/projects` | プロジェクト一覧 |

## Implementation Phases

### Phase 1: 基盤 — Xcodeプロジェクト + API通信

- [x] `macos-menubar/` にXcodeプロジェクト作成（SPM構成）
- [x] `Info.plist`: `LSUIElement = YES`
- [x] `App.swift`: `MenuBarExtra` + `.menuBarExtraStyle(.window)` でメニューバー常駐
- [x] `APIClient.swift`: `actor` ベースのREST APIクライアント（Bearer Token認証）
- [x] `Models/`: `Todo`, `Project`, `Session` のCodable構造体（APIレスポンスに対応）
- [x] `AppState.swift`: `@Observable` で状態管理（todos, sessions, projects）
- [x] `.gitignore`: `xcuserdata/`, `*.xcworkspace/xcuserdata/` を追加
- [ ] Entitlements: `com.apple.security.network.client` 有効化（Xcodeプロジェクト作成後に設定）

**ファイル構成:**
```
macos-menubar/
  TaskFlowBar/
    App.swift
    AppDelegate.swift
    Info.plist
    TaskFlowBar.entitlements
    Models/
      Todo.swift
      Project.swift
      Session.swift
    Services/
      APIClient.swift
    Stores/
      AppState.swift
    Views/
      MainPanelView.swift
```

### Phase 2: メインUI — ポップオーバーパネル

- [x] `MainPanelView.swift`: 今日のタスク + 進行中タスク一覧（ポップオーバー表示）
- [x] タスクの優先度表示（色分け: high=赤, medium=黄, low=灰）
- [x] セッション表示セクション（アクティブセッション + リンク済みタスク数）
- [x] 「Taskflowを開く」ボタン → `NSWorkspace.shared.open(URL)` でブラウザ起動
- [x] 設定ボタン → SettingsView（APIトークン入力、起動設定）
- [x] データ取得: アプリ起動時 + ポップオーバー表示時にリフレッシュ
- [x] フレームサイズ: `width: 350, height: 500`

### Phase 3: WebSocketリアルタイム通知

- [x] `WebSocketClient.swift`: `URLSessionWebSocketTask` + `AsyncThrowingStream` で接続
- [x] 接続URL: `wss://taskflow.kenji-draemon.workers.dev/api/realtime?token={token}&client_id={uuid}`
- [x] 再接続: 指数バックオフ（1s→2s→4s→...→10s max）+ ランダムジッター
- [x] `invalidate` イベント受信 → 該当リソースをAPIで再取得
- [x] `NotificationManager.swift`: `UNUserNotificationCenter` でmacOS通知
- [x] 通知トリガー: `todos` リソース変更時に「タスクが更新されました」通知
- [x] 通知の許可リクエスト（初回起動時）

### Phase 4: グローバルホットキー + Login Items

- [x] SPM依存追加: `soffes/HotKey`（固定ショートカット用）
- [x] `HotKeyManager.swift`: `Cmd+Shift+T` でポップオーバートグル（AppDelegate内に統合）
- [x] `SMAppService.mainApp.register()` でLogin Items登録
- [x] `SettingsView.swift`: 「ログイン時に起動」トグル

## Acceptance Criteria

### Functional Requirements

- [ ] メニューバーにアイコンが常駐する（Dockアイコンなし）
- [ ] クリックでポップオーバーが開き、今日のタスク・進行中タスクが表示される
- [ ] 「Taskflowを開く」でデフォルトブラウザでWebアプリが開く
- [ ] WebSocket経由でリアルタイムにタスク変更を検知し、macOS通知を表示する
- [ ] Cmd+Shift+Tでポップオーバーをトグルできる
- [ ] macOS起動時に自動的に常駐する（Login Items）

### Non-Functional Requirements

- [ ] macOS 14+ (Sonoma) をサポート
- [ ] メモリ使用量 < 50MB
- [ ] API通信はすべてHTTPS
- [ ] トークンはKeychainまたはUserDefaultsに保存（平文ファイルに書かない）

## Dependencies & Risks

**依存:**
- Xcode 15+ が必要
- `soffes/HotKey` SPMパッケージ

**リスク:**
- メニューバーアプリからSettings表示にはactivation policy切り替えのハックが必要（既知のSwiftUI制限）
- WebSocket接続がCFのDurable Object仕様に依存

## References

### Internal

- WebSocket接続: `frontend/src/stores/realtime-store.ts`
- APIクライアント: `frontend/src/lib/api.ts`
- 認証: `src/middleware/auth.ts`
- Realtimeハブ: `src/realtime/RealtimeHub.ts`
- ブレストドキュメント: `docs/brainstorms/2026-03-09-macos-menubar-app-brainstorm.md`

### External

- [MenuBarExtra - Apple Docs](https://developer.apple.com/documentation/swiftui/menubarextra)
- [HotKey - soffes/HotKey](https://github.com/soffes/HotKey)
- [SMAppService - Apple Docs](https://developer.apple.com/documentation/servicemanagement/smappservice)
