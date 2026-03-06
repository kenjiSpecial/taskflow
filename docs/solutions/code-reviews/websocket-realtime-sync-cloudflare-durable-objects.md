---
title: "WebSocket リアルタイム同期機能のコードレビュー"
date: 2026-03-06
problem_type: code-review
component: realtime-sync
severity: mixed
status: review-complete
tags:
  - websocket
  - durable-objects
  - realtime
  - security
  - performance
  - cloudflare-workers
  - preact-signals
modules_affected:
  - src/realtime/RealtimeHub.ts
  - src/realtime/publish.ts
  - src/routes/realtime.ts
  - frontend/src/stores/realtime-store.ts
  - frontend/src/lib/client-id.ts
  - src/routes/todos.ts
  - src/routes/projects.ts
  - src/routes/sessions.ts
  - src/routes/tags.ts
  - frontend/src/app.tsx
findings_summary:
  p1_critical: 2
  p2_important: 7
  p3_nice_to_have: 5
  total: 14
related_docs:
  - docs/plans/2026-03-06-feat-websocket-realtime-frontend-sync-plan.md
  - docs/solutions/logic-errors/preact-signals-store-architecture-code-review-findings.md
  - docs/solutions/ui-bugs/preact-signal-misuse-and-code-review-fixes.md
---

# WebSocket リアルタイム同期機能のコードレビュー

## 概要

commit `5886c92` で追加された WebSocket リアルタイム同期機能のコードレビュー結果。
Cloudflare Durable Objects を WebSocket ハブとして使い、invalidation ベースの同期パターンを実装。

**アーキテクチャ**: mutation → Durable Object に publish → 全クライアントにブロードキャスト → クライアントが REST API で再取得

## Findings

### P1 Critical (2件)

#### 1. publishRealtimeInvalidation が API レスポンスをブロック

**問題**: 全ルートハンドラが `await publishRealtimeInvalidation()` で DO への内部 HTTP POST 完了を待っており、API レスポンスに 5-50ms の遅延が追加される。

**影響ファイル**: `src/routes/todos.ts`, `projects.ts`, `sessions.ts`, `tags.ts`

**根本原因**: publish 呼び出しが request の critical path 上にある。publish 結果はレスポンス構築に不要。

**修正**:

```typescript
// Before (blocking)
await publishRealtimeInvalidation(c.env, {
  resources: ["todos"],
  reason: "todo.created",
  origin_client_id: getOriginClientId(c),
});

// After (non-blocking)
c.executionCtx.waitUntil(
  publishRealtimeInvalidation(c.env, {
    resources: ["todos"],
    reason: "todo.created",
    origin_client_id: getOriginClientId(c),
  })
);
```

---

#### 2. WebSocket 認証トークンが URL に露出

**問題**: `?token=<API_TOKEN>` がサーバーログ、ブラウザ履歴、Cloudflare ダッシュボードに記録される。

**影響ファイル**: `frontend/src/stores/realtime-store.ts:45-46`, `src/middleware/auth.ts:6`

**根本原因**: WebSocket API はブラウザからカスタムヘッダーを送信できないため、トークンをクエリパラメータで渡している。

**短期対応**: 個人ツールとして許容。ログにクエリ文字列を含めないよう留意。

**長期修正 — チケット交換パターン**:

```
1. Client → POST /api/ws/ticket (Authorization: Bearer <token>)
   → Server returns { ticket: "<one-time-uuid>" } (30秒有効)
2. Client → ws://host/ws?ticket=<one-time-uuid>
   → Server validates & invalidates ticket, upgrades connection
```

---

### P2 Important (7件)

#### 3. スプレッド演算子の順序バグ (`publish.ts:33-38`)

**問題**: `...event` が固定フィールド（`type`, `scope`, `occurred_at`）の後にあるため、型ガードをバイパスすれば上書き可能。

**修正**: 固定フィールドを最後に配置。

```typescript
// Before
const payload = { type: "invalidate", scope: "all", occurred_at: now(), ...event };
// After
const payload = { ...event, type: "invalidate", scope: "all", occurred_at: now() };
```

#### 4. 初回接続時のデータ二重取得

**問題**: `app.tsx` で全リソースロード → `connectRealtime()` の `open` で `queueInitialSync()` が再度全リソースをフェッチ。

**修正**: 初回接続時はスキップ、再接続時のみ実行。

```typescript
socket.addEventListener("open", () => {
  const wasReconnect = reconnectAttempt.value > 0;
  reconnectAttempt.value = 0;
  realtimeStatus.value = "connected";
  if (wasReconnect) queueInitialSync();
});
```

#### 5. リソース invalidation が過剰

**問題**: `todo.created` → `["projects", "todos", "sessions"]` だが sessions は変更なし。

**修正**: 各 publish 呼び出しで実際に変更されたリソースのみに絞る。

| Event | 適切な Resources |
|---|---|
| `todo.created/updated/deleted` | `["todos"]` (project count 変更時は `"projects"` も) |
| `session.created/updated` | `["sessions"]` |
| `tag.created` | `["tags"]` のみ |

#### 6. Durable Object `/publish` に認証・バリデーションなし

**問題**: `request.json<RealtimeInvalidationEvent>()` は型キャストのみ。任意の JSON がブロードキャストされる。

**修正**: Zod バリデーション追加。

```typescript
const parsed = realtimeEventSchema.safeParse(await request.json());
if (!parsed.success) return new Response("Invalid event", { status: 400 });
this.broadcast(parsed.data);
```

#### 7. WebSocket close イベントの race condition

**問題**: `disconnectRealtime()` → stale socket の close イベント → 新しい接続と競合。

**修正**: stale socket を検出して早期 return。

```typescript
socket.addEventListener("close", () => {
  if (socketRef.value !== socket) return; // stale socket
  socketRef.value = null;
  realtimeStatus.value = "disconnected";
  scheduleReconnect();
});
```

#### 8. getOriginClientId が 4 ファイルに重複

**問題**: `todos.ts:23`, `projects.ts:31`, `sessions.ts:17`, `tags.ts:10` に同一関数。

**修正**: `src/realtime/publish.ts` にエクスポートとして統合。

#### 9. RealtimeHub が DurableObject 基底クラスを未継承

**問題**: `wrangler.jsonc` で `new_sqlite_classes` 指定だが、クラスは `DurableObject` を extend していない。SQLite も未使用。

**修正**:

```typescript
import { DurableObject } from "cloudflare:workers";
export class RealtimeHub extends DurableObject { ... }
```

`wrangler.jsonc` で `new_sqlite_classes` → `new_classes` に変更。

---

### P3 Nice-to-have (5件)

#### 10. YAGNI: 未使用イベントフィールド

`scope`（常に `"all"`）, `project_id`, `entity_id`, `reason`, `occurred_at` はフロントエンドで一切読まれていない。実際に使われるのは `type`, `resources`, `origin_client_id` の 3 フィールドのみ。

#### 11. Dead code: ping/pong と ready メッセージ

サーバーが `ready` 送信・`ping` 応答するが、クライアントは `ping` を送らず `ready`/`pong` を無視。

#### 12. 未使用エクスポート

`lastRealtimeEventAt`, `lastRealtimeError` シグナルが export されているがどのコンポーネントからも import されていない。

#### 13. RealtimeResource 型の重複定義

`src/realtime/publish.ts:3` と `frontend/src/stores/realtime-store.ts:10` で独立して同一の型を定義。

#### 14. タイムスタンプフォーマットの散在

`.replace(/\.\d{3}Z$/, "Z")` が 4 箇所に散在。共通ユーティリティに抽出すべき。

---

## アーキテクチャ評価

| 観点 | 評価 | コメント |
|---|---|---|
| 設計方針（invalidation + re-fetch） | 適切 | 個人ツールとして正しい選択。差分同期は過剰 |
| Single Global DO | 適切 | 個人利用では十分。32K 接続まで対応可能 |
| エラー分離 | 良好 | WS 障害が REST API に影響しない設計 |
| Signals ルール準拠 | 良好 | module-level で `signal()`/`computed()` を正しく使用 |
| Store 経由アクセス | 良好 | re-fetch は既存 store 関数経由 |
| DRY | 違反 | `getOriginClientId` の 4 箇所重複 |

---

## 防止策チェックリスト

今後のコードレビュー・実装時に参照:

| # | 観点 | チェック |
|---|------|---------|
| 1 | `await` の妥当性 | レスポンスに必要？不要なら `waitUntil()` |
| 2 | 認証情報の配置 | URL に秘密情報が含まれていないか |
| 3 | スプレッド順序 | 固定フィールドが最後か |
| 4 | データフェッチ | 二重取得の防止策があるか |
| 5 | 無効化範囲 | 影響範囲のみの再取得か |
| 6 | 入力バリデーション | 全信頼境界で Zod 検証しているか |
| 7 | 非同期クリーンアップ | stale 参照の検出があるか |
| 8 | コード重複 | 同じパターンが 2 箇所以上にないか |
| 9 | YAGNI | 追加したものすべてに今の利用者がいるか |

---

## 関連ドキュメント

- [WebSocket リアルタイム同期 実装計画](../../plans/2026-03-06-feat-websocket-realtime-frontend-sync-plan.md)
- [Preact Signals Store アーキテクチャ レビュー](../logic-errors/preact-signals-store-architecture-code-review-findings.md)
- [Preact Signal 誤用とコードレビュー修正](../ui-bugs/preact-signal-misuse-and-code-review-fixes.md)
