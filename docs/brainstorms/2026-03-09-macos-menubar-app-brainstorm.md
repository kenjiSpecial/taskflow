---
title: macOSメニューバーアプリ
date: 2026-03-09
status: active
---

# macOSメニューバーアプリ

## What We're Building

macOSメニューバーに常駐するSwiftネイティブアプリ。主な目的は**タスクのクイック確認**。

### 機能

1. **クイック確認（最優先）**
   - メニューバーアイコンをクリック → ドロップダウンメニューで今日のタスク・進行中タスクをリスト表示
   - 詳細を見たい場合はポップオーバーパネルで表示（Raycast風）

2. **通知（WebSocketリアルタイム）**
   - 既存のRealtimeHub（Durable Objects）WebSocketに接続
   - タスクの期限リマインダー、リアルタイム更新通知をmacOS通知センターに表示

3. **Taskflowを開く**
   - メニューからクリックでデフォルトブラウザでTaskflow Webアプリを開く

## Why This Approach

**Swiftネイティブを選択した理由:**
- macOS通知センターとのネイティブ統合（UNUserNotificationCenter）
- NSStatusBarでメニューバー常駐が自然
- メモリフットプリントが小さい（Electron比）
- SwiftUIでポップオーバーUIが簡単に作れる

**データ取得方法:**
- Taskflow REST API（Bearer Token認証）を直接呼び出す
- WebSocket接続は既存のRealtimeHub URLに接続

## Key Decisions

- **技術**: Swift + SwiftUI（ネイティブ）
- **UI**: ドロップダウンメニュー（簡易）+ ポップオーバーパネル（詳細）
- **通知**: WebSocketでリアルタイム（既存インフラ活用）
- **Webアプリ起動**: デフォルトブラウザで開く（WebView不使用）
- **API通信**: Taskflow REST APIを直接呼び出し（ブリッジサーバー経由ではない）

## Resolved Questions

1. **ログイン起動**: → はい。Login Itemsに登録して自動起動する
2. **バッジ表示**: → 不要。アイコンのみでシンプルに
3. **ショートカットキー**: → はい。グローバルホットキー（Cmd+Shift+T）でポップオーバーを開く
4. **配布方法**: → 同じリポジトリ内に `macos-menubar/` ディレクトリを作成
