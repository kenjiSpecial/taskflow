---
title: "feat: メニューバーからローカルサーバーを起動"
type: feat
status: active
date: 2026-03-09
---

# feat: メニューバーからローカルサーバーを起動

ローカルサーバーが起動していない時、TaskFlowBarからバックエンド・フロントエンドを起動できるようにする。

## Acceptance Criteria

- [ ] ヘルスチェック (`GET /health`) でサーバー接続状態を検知
- [ ] サーバー未起動時に「サーバーを起動」ボタンを表示
- [ ] ボタン押下でバックエンド (`npm run dev`) とフロントエンド (`cd frontend && npm run dev`) を起動
- [ ] 起動中のステータス表示（起動中… → 起動完了）
- [ ] 起動完了後に自動でデータを取得

## Context

### 既存パターン

- **ヘルスチェック**: `GET /health` → `{"status":"ok"}`（認証不要、`src/index.ts:20`）
- **接続状態**: `AppState.lastError` にエラーを格納済み
- **プロジェクトルート**: メニューバーアプリから見て `../../`（`macos-menubar/` の親）

### 技術方針

- `Foundation.Process` でシェルコマンドを実行
- プロジェクトルートパスは設定画面で指定可能にする（デフォルト: 空）
- バックグラウンドプロセスとして起動し、アプリ終了時にクリーンアップ

## MVP

### `macos-menubar/TaskFlowBar/Services/ServerManager.swift`

```swift
import Foundation

@Observable
@MainActor
class ServerManager {
    var isBackendRunning = false
    var isFrontendRunning = false
    var isStarting = false

    private var backendProcess: Process?
    private var frontendProcess: Process?

    var projectRoot: String {
        get { UserDefaults.standard.string(forKey: "projectRoot") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "projectRoot") }
    }

    /// GET /health でバックエンド生存確認
    func checkHealth(apiURL: String) async {
        guard let url = URL(string: "\(apiURL)/health") else { return }
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            isBackendRunning = (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            isBackendRunning = false
        }
    }

    /// npm run dev でバックエンド+フロントエンドを起動
    func startServers() async { ... }

    /// プロセス終了
    func stopServers() { ... }
}
```

### `macos-menubar/TaskFlowBar/Views/MainPanelView.swift` 変更

```swift
// サーバー未接続時にunconfiguredViewの代わりに表示
if !serverManager.isBackendRunning && appState.lastError != nil {
    serverOfflineView  // 「サーバーを起動」ボタン
}
```

### `macos-menubar/TaskFlowBar/Stores/AppState.swift` 変更

```swift
// refreshData() 失敗時にヘルスチェック実行
// → isBackendRunning = false → UI に起動ボタン表示
```

### `macos-menubar/TaskFlowBar/Views/SettingsView.swift` 変更

```swift
// プロジェクトルートパス設定フィールド追加
TextField("プロジェクトルート", text: $serverManager.projectRoot)
```

## 実装ステップ

- [ ] `ServerManager.swift` 作成（ヘルスチェック + Process起動）
- [ ] `AppState` に `ServerManager` を統合
- [ ] `MainPanelView` にサーバーオフライン表示 + 起動ボタン追加
- [ ] `SettingsView` にプロジェクトルート設定追加
- [ ] アプリ終了時のプロセスクリーンアップ（`AppDelegate`）
- [ ] ビルド・動作確認

## References

- ヘルスチェックエンドポイント: `src/index.ts:20`
- AppState: `macos-menubar/TaskFlowBar/Stores/AppState.swift`
- MainPanelView: `macos-menubar/TaskFlowBar/Views/MainPanelView.swift`
- Foundation.Process: macOS shell command execution
