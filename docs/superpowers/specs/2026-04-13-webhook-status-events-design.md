# Webhook: ready_for_code トリガー

## 概要

タスクのステータスが `ready_for_code` になったら、ローカルマシンで指定のシェルコマンドを自動実行する。

ユースケース: エージェントが自動でコーディングを開始する。

## アーキテクチャ

```
[Taskflow Workers - PATCH /api/todos/:id]
  → DB更新
  → publishRealtimeInvalidation() に old_status / new_status を追加
  → RealtimeHub DO → WebSocket broadcast

[ローカル Mac - taskflow-ready-watcher (Node.js スクリプト)]
  → WebSocket接続 (wss://taskflow.kenji-draemon.workers.dev/api/realtime?token=...)
  → todo.updated イベントを受信
  → new_status === "ready_for_code" のみ反応
  → 環境変数 TASKFLOW_WEBHOOK_CMD で指定したコマンドを spawn()
```

## Part 1: Workers側 — イベント詳細化

### 変更対象

- `src/realtime/publish.ts` — `RealtimeInvalidationEvent` 型 + zodスキーマに `old_status?` / `new_status?` を追加
- `src/routes/todos.ts` — PATCHハンドラでstatus変更時のみ両フィールドを付与

### 変更内容

```typescript
// src/realtime/publish.ts
export interface RealtimeInvalidationEvent {
  // ...既存フィールド
  old_status?: string;
  new_status?: string;
}
// zodスキーマにも同様に追加
```

```typescript
// src/routes/todos.ts PATCH handler
publishRealtimeInvalidation(c.env, {
  resources: [...resources],
  reason: "todo.updated",
  origin_client_id: getOriginClientId(c),
  project_id: todo?.project_id ?? existing.project_id ?? null,
  entity_id: id,
  ...(data.status && data.status !== existing.status
    ? { old_status: existing.status, new_status: data.status }
    : {}),
})
```

破壊的変更なし（既存クライアントは追加フィールドを無視）。

## Part 2: ローカルウォッチャー — taskflow-ready-watcher

### 配置

`~/.agents/tools/taskflow-ready-watcher/index.ts`（単一ファイル）

### 動作

1. `TASKFLOW_API_TOKEN` でWebSocket接続
2. `type === "invalidate"` かつ `reason === "todo.updated"` かつ `new_status === "ready_for_code"` のイベントのみ処理
3. `TASKFLOW_WEBHOOK_CMD` 環境変数のコマンドを `spawn()` で実行
   - コマンド内の `{entity_id}` を todo ID で置換
   - コマンドは引数分割済みの配列として渡す（シェルインジェクション回避）
4. 切断時: 5秒後に自動再接続

### 設定（環境変数のみ、設定ファイルなし）

```bash
export TASKFLOW_API_URL="wss://taskflow.kenji-draemon.workers.dev/api/realtime"
export TASKFLOW_API_TOKEN="..."
export TASKFLOW_WEBHOOK_CMD="claude --dangerously-skip-permissions -p タスク {entity_id} を実装してください"
```

### ループ防止

`origin_client_id` を送らないため、ウォッチャー自身がトリガーしたステータス変更にも反応する可能性がある。初期実装ではこれを許容し、必要になったら追加。

## 検証

```bash
# 1. ウォッチャー起動
cd ~/.agents/tools/taskflow-ready-watcher
TASKFLOW_WEBHOOK_CMD="echo fired: {entity_id}" npx tsx index.ts

# 2. 別ターミナルでステータス変更
curl -X PATCH https://taskflow.kenji-draemon.workers.dev/api/todos/:id \
  -H "Authorization: Bearer $TASKFLOW_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready_for_code"}'

# 3. ウォッチャー側に "fired: <id>" が表示されることを確認
```
