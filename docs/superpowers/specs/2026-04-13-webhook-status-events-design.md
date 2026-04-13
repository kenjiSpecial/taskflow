# Webhook: ステータス変更イベント配信 + ローカルCLIリスナー

## 概要

Taskflowのtodoステータス変更をリアルタイムでローカルマシンに配信し、条件に応じてシェルコマンド（Claude Code等）を自動実行する。

主要ユースケース: タスクが`ready_for_code`になったら、エージェントが自動でコーディングを開始する。

## アーキテクチャ

```
[Taskflow Workers - PATCH /api/todos/:id]
  → DB更新
  → publishRealtimeInvalidation() に old_status / new_status を追加
  → RealtimeHub DO → WebSocket broadcast（全クライアントへ）

[ローカル Mac - taskflow-webhook-listener]
  → WebSocket接続 (wss://taskflow.kenji-draemon.workers.dev/api/realtime?token=...)
  → "todo.updated" イベントを受信
  → ルール設定に基づきフィルタ（new_status == "ready_for_code" 等）
  → 条件合致 → シェルコマンド実行
```

## Part 1: Workers側 — イベント詳細化

### 変更対象ファイル

- `src/realtime/publish.ts` — `RealtimeInvalidationEvent` 型 + zodスキーマ
- `src/routes/todos.ts` — PATCHハンドラの `publishRealtimeInvalidation` 呼び出し

### イベントスキーマ拡張

`RealtimeInvalidationEvent` に以下のオプショナルフィールドを追加:

```typescript
// src/realtime/publish.ts
export interface RealtimeInvalidationEvent {
  // ... 既存フィールド
  old_status?: string;   // 変更前のstatus
  new_status?: string;   // 変更後のstatus
}
```

zodスキーマ (`realtimeInvalidationEventSchema`) にも同様に追加:

```typescript
old_status: z.string().optional(),
new_status: z.string().optional(),
```

### PATCHハンドラの変更

`src/routes/todos.ts` の PATCH `/api/todos/:id` ハンドラで、status変更があった場合にのみ `old_status` / `new_status` をイベントに含める:

```typescript
c.executionCtx.waitUntil(
  publishRealtimeInvalidation(c.env, {
    resources: [...resources],
    reason: "todo.updated",
    origin_client_id: getOriginClientId(c),
    project_id: todo?.project_id ?? existing.project_id ?? null,
    entity_id: id,
    // ステータス変更時のみ追加
    ...(data.status && data.status !== existing.status
      ? { old_status: existing.status, new_status: data.status }
      : {}),
  }),
);
```

影響範囲: 既存のフロントエンドWebSocketクライアントは追加フィールドを無視するため、破壊的変更なし。

## Part 2: CLIデーモン — taskflow-webhook-listener

### 配置

`~/.agents/tools/taskflow-webhook-listener/`

### 構成

```
taskflow-webhook-listener/
├── src/
│   ├── index.ts          # エントリポイント（WebSocket接続 + イベントループ）
│   ├── config.ts         # YAML設定読み込み
│   └── executor.ts       # コマンド実行（子プロセス起動）
├── config.yaml           # ルール定義
├── package.json
└── tsconfig.json
```

### 設定ファイル (`config.yaml`)

```yaml
websocket_url: "wss://taskflow.kenji-draemon.workers.dev/api/realtime"
# token は環境変数 TASKFLOW_API_TOKEN から読み込み

rules:
  - name: "auto-code-on-ready"
    trigger:
      reason: "todo.updated"
      new_status: "ready_for_code"
    action:
      command: "claude -p 'Taskflowのタスク {{entity_id}} を実装してください。GET /api/todos/{{entity_id}} でタスク詳細を取得し、titleとdescriptionに基づいてコーディングしてください。'"
      cwd: "~/github"  # 実行ディレクトリ（オプション）

  - name: "notify-done"
    trigger:
      reason: "todo.updated"
      new_status: "done"
    action:
      command: "echo 'タスク {{entity_id}} が完了しました'"
```

### テンプレート変数

コマンド文字列内で以下の変数を `{{variable}}` 形式で展開:

- `{{entity_id}}` — todo ID
- `{{old_status}}` — 変更前ステータス
- `{{new_status}}` — 変更後ステータス
- `{{reason}}` — イベント理由（例: "todo.updated"）
- `{{project_id}}` — プロジェクトID

### 主要ロジック

**WebSocket接続:**
- `TASKFLOW_API_TOKEN` 環境変数からトークンを取得
- `wss://...?token=<TOKEN>` で接続
- 切断時: 5秒後に自動再接続（exponential backoffなし、シンプルに固定間隔）
- `ping/pong` keepalive対応

**イベント処理:**
```
受信 → JSONパース → reason/new_statusでルールマッチ → テンプレート展開 → child_process.exec()
```

- 同一entity_idに対する重複実行を防止（直近N秒以内の同一ルール+entity_idはスキップ）
- コマンド実行は非同期（完了を待たない）
- stdout/stderrをログ出力

### 常駐化（launchd）

`com.taskflow.webhook-listener.plist` をオプションで提供。ユーザーが `launchctl load` で常駐化可能。

## 検証手順

1. Workers側をデプロイ後、WebSocket接続してイベントを確認:
   ```bash
   wscat -c "wss://taskflow.kenji-draemon.workers.dev/api/realtime?token=$TASKFLOW_API_TOKEN"
   ```
2. 別ターミナルでタスクのステータスを変更:
   ```bash
   curl -X PATCH .../api/todos/:id -d '{"status":"ready_for_code"}'
   ```
3. WebSocketで `old_status` / `new_status` が含まれるイベントを確認
4. CLIリスナーを起動して、ルールに基づくコマンド実行を確認
