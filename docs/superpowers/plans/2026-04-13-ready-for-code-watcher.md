# ready_for_code Watcher 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タスクのステータスが `ready_for_code` になったとき、ローカルでシェルコマンドを自動実行するウォッチャーを作る。

**Architecture:** Workers側のリアルタイムイベントに `old_status`/`new_status` フィールドを追加し、ローカルの単一TSファイルがWebSocketでそれを受信・フィルタしてコマンドを実行する。

**Tech Stack:** Hono/Cloudflare Workers (既存), TypeScript, ws (WebSocket client), tsx (実行)

---

## ファイルマップ

| 操作 | パス | 内容 |
|------|------|------|
| Modify | `src/realtime/publish.ts` | `RealtimeInvalidationEvent` 型とzodスキーマに `old_status?`/`new_status?` 追加 |
| Modify | `src/routes/todos.ts` | PATCHハンドラでstatus変更時に両フィールドを付与 |
| Create | `~/.agents/tools/taskflow-ready-watcher/index.ts` | WebSocket接続・フィルタ・コマンド実行の単一ファイル |
| Create | `~/.agents/tools/taskflow-ready-watcher/package.json` | bun + ws 依存 |

---

## Task 1: Workers — イベントスキーマに status フィールドを追加

**Files:**
- Modify: `src/realtime/publish.ts`

- [ ] **Step 1: `RealtimeInvalidationEvent` 型に追加**

`src/realtime/publish.ts` の `RealtimeInvalidationEvent` インターフェース（現在12-21行目）を編集:

```typescript
export interface RealtimeInvalidationEvent {
  type: "invalidate";
  scope: "all";
  resources: RealtimeResource[];
  reason: string;
  origin_client_id?: string;
  project_id?: string | null;
  entity_id?: string;
  occurred_at: string;
  old_status?: string;  // ← 追加
  new_status?: string;  // ← 追加
}
```

- [ ] **Step 2: zodスキーマに追加**

同ファイルの `realtimeInvalidationEventSchema`（現在32-41行目）に追加:

```typescript
export const realtimeInvalidationEventSchema = z.object({
  type: z.literal("invalidate"),
  scope: z.literal("all"),
  resources: z.array(realtimeResourceSchema).min(1),
  reason: z.string().min(1),
  origin_client_id: z.string().min(1).optional(),
  project_id: z.string().nullable().optional(),
  entity_id: z.string().min(1).optional(),
  occurred_at: z.string().min(1),
  old_status: z.string().optional(),  // ← 追加
  new_status: z.string().optional(),  // ← 追加
});
```

- [ ] **Step 3: TypeScript型エラーがないか確認**

```bash
cd /Users/kenjisaito/github/taskflow
npx tsc --noEmit 2>&1 | head -20
```

Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
cd /Users/kenjisaito/github/taskflow
git add src/realtime/publish.ts
git commit -m "feat(realtime): イベントにold_status/new_statusフィールドを追加"
```

---

## Task 2: Workers — PATCHハンドラでstatus変更を検出して付与

**Files:**
- Modify: `src/routes/todos.ts`（310-318行目付近）

- [ ] **Step 1: publishRealtimeInvalidation 呼び出しを修正**

`src/routes/todos.ts` の PATCH ハンドラ内の `c.executionCtx.waitUntil(...)` ブロック（310-318行目）を以下に置き換え:

```typescript
  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: [...resources],
      reason: "todo.updated",
      origin_client_id: getOriginClientId(c),
      project_id: todo?.project_id ?? existing.project_id ?? null,
      entity_id: id,
      ...(data.status !== undefined && data.status !== existing.status
        ? { old_status: existing.status, new_status: data.status }
        : {}),
    }),
  );
```

- [ ] **Step 2: TypeScript型エラーがないか確認**

```bash
cd /Users/kenjisaito/github/taskflow
npx tsc --noEmit 2>&1 | head -20
```

Expected: エラーなし

- [ ] **Step 3: ローカルでイベント確認（wscat使用）**

```bash
# ターミナル1: WebSocket接続
wscat -c "wss://taskflow.kenji-draemon.workers.dev/api/realtime?token=$TASKFLOW_API_TOKEN"

# ターミナル2: ステータス変更
curl -s -X PATCH "https://taskflow.kenji-draemon.workers.dev/api/todos/<任意のID>" \
  -H "Authorization: Bearer $TASKFLOW_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready_for_code"}' | jq .
```

Expected (ターミナル1に届くイベント):
```json
{
  "type": "invalidate",
  "reason": "todo.updated",
  "old_status": "todo",
  "new_status": "ready_for_code",
  "entity_id": "<id>",
  ...
}
```

- [ ] **Step 4: Deploy & Commit**

```bash
cd /Users/kenjisaito/github/taskflow
npx wrangler deploy 2>&1 | tail -5
git add src/routes/todos.ts
git commit -m "feat(todos): ステータス変更時にold_status/new_statusをイベントに付与"
```

---

## Task 3: CLIウォッチャー — package.json と依存セットアップ

**Files:**
- Create: `~/.agents/tools/taskflow-ready-watcher/package.json`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p ~/.agents/tools/taskflow-ready-watcher
```

- [ ] **Step 2: package.json 作成**

`~/.agents/tools/taskflow-ready-watcher/package.json`:

```json
{
  "name": "taskflow-ready-watcher",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "bun run index.ts"
  },
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.13"
  }
}
```

- [ ] **Step 3: 依存インストール**

```bash
cd ~/.agents/tools/taskflow-ready-watcher
bun install
```

Expected: `node_modules/ws` が生成される

---

## Task 4: CLIウォッチャー — index.ts 実装

**Files:**
- Create: `~/.agents/tools/taskflow-ready-watcher/index.ts`

- [ ] **Step 1: index.ts を作成**

`~/.agents/tools/taskflow-ready-watcher/index.ts`:

```typescript
import WebSocket from "ws";
import { spawn } from "child_process";

// --- 設定 ---
const WS_URL = process.env.TASKFLOW_API_URL
  ?? "wss://taskflow.kenji-draemon.workers.dev/api/realtime";
const TOKEN = process.env.TASKFLOW_API_TOKEN;
const WEBHOOK_CMD = process.env.TASKFLOW_WEBHOOK_CMD;
const RECONNECT_DELAY_MS = 5000;

if (!TOKEN) {
  console.error("ERROR: TASKFLOW_API_TOKEN is not set");
  process.exit(1);
}
if (!WEBHOOK_CMD) {
  console.error("ERROR: TASKFLOW_WEBHOOK_CMD is not set");
  process.exit(1);
}

// --- コマンド実行 ---
function runCommand(entityId: string): void {
  // {entity_id} を置換してからスペース分割（シェル経由ではなくspawnで実行）
  const cmdWithId = WEBHOOK_CMD!.replace(/\{entity_id\}/g, entityId);
  const parts = cmdWithId.split(/\s+/);
  const [bin, ...args] = parts;

  console.log(`[watcher] executing: ${cmdWithId}`);

  const child = spawn(bin, args, {
    stdio: "inherit",
    detached: true,
  });

  child.on("error", (err) => {
    console.error(`[watcher] command error:`, err.message);
  });

  child.on("exit", (code) => {
    console.log(`[watcher] command exited with code ${code}`);
  });

  child.unref(); // 親プロセスの終了を待たない
}

// --- WebSocket接続 ---
function connect(): void {
  const url = `${WS_URL}?token=${TOKEN}`;
  const ws = new WebSocket(url);

  ws.on("open", () => {
    console.log("[watcher] connected to Taskflow realtime");
  });

  ws.on("message", (data) => {
    let event: unknown;
    try {
      event = JSON.parse(data.toString());
    } catch {
      return; // 無視
    }

    if (
      typeof event !== "object" ||
      event === null ||
      (event as Record<string, unknown>).type !== "invalidate" ||
      (event as Record<string, unknown>).reason !== "todo.updated" ||
      (event as Record<string, unknown>).new_status !== "ready_for_code"
    ) {
      return;
    }

    const entityId = (event as Record<string, unknown>).entity_id;
    if (typeof entityId !== "string") return;

    console.log(`[watcher] ready_for_code detected: ${entityId}`);
    runCommand(entityId);
  });

  ws.on("close", () => {
    console.log(`[watcher] disconnected. reconnecting in ${RECONNECT_DELAY_MS}ms...`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  ws.on("error", (err) => {
    console.error("[watcher] ws error:", err.message);
    // close イベントが後続するので再接続はそちらで処理
  });
}

console.log("[watcher] starting taskflow-ready-watcher");
connect();
```

- [ ] **Step 2: 起動テスト（echoコマンドで確認）**

```bash
cd ~/.agents/tools/taskflow-ready-watcher
TASKFLOW_WEBHOOK_CMD="echo TRIGGERED entity={entity_id}" bun run index.ts
```

Expected: `[watcher] connected to Taskflow realtime` が表示される

- [ ] **Step 3: 別ターミナルでステータス変更してトリガー確認**

```bash
# 適当なtodo IDを使う
curl -s -X PATCH "https://taskflow.kenji-draemon.workers.dev/api/todos/<ID>" \
  -H "Authorization: Bearer $TASKFLOW_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready_for_code"}' | jq .status
```

Expected（ウォッチャー側）:
```
[watcher] ready_for_code detected: <ID>
[watcher] executing: echo TRIGGERED entity=<ID>
TRIGGERED entity=<ID>
[watcher] command exited with code 0
```

- [ ] **Step 4: Commit（agentsリポジトリ側）**

```bash
cd ~/.agents
git add tools/taskflow-ready-watcher/
git commit -m "feat(tools): taskflow-ready-watcherを追加（ready_for_codeトリガー）"
git push origin main
```

---

## 使い方まとめ（実装後）

```bash
# ~/.zshrc に追記推奨
export TASKFLOW_API_TOKEN="..."
export TASKFLOW_WEBHOOK_CMD="claude --dangerously-skip-permissions -p タスク {entity_id} の実装を開始してください"

# 起動
cd ~/.agents/tools/taskflow-ready-watcher
bun run index.ts
```
