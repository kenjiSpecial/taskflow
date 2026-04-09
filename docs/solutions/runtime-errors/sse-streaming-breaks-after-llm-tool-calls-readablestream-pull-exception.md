---
title: "SSEストリーミング中のツール呼び出し後にERR_INCOMPLETE_CHUNKED_ENCODINGが発生する"
date: 2026-03-09
category: runtime-errors
tags:
  - sse
  - streaming
  - error-handling
  - openrouter
  - bun
  - chunked-encoding
  - tool-calling
  - agent-loop
  - readablestream
severity: high
components:
  - taskflow-cmux-server.ts
  - handleChat
  - piStream
symptoms:
  - "Browser: ERR_INCOMPLETE_CHUNKED_ENCODING 200 (OK)"
  - "Chat UIで「network error」表示（ツール実行完了後）"
  - "初回ストリーミングは正常、ツール呼び出し後の2回目ループで接続断"
  - "サーバープロセス自体は生存、個別SSEストリームのみ破損"
  - "moonshotai/kimi-k2.5モデル切替時に顕在化"
---

# SSEストリーミング: ツール呼び出し後のERR_INCOMPLETE_CHUNKED_ENCODING

## Problem Statement

Bun bridge server (`taskflow-cmux-server.ts`) でOpenRouter経由のLLMチャットをSSEストリーミングで配信中、エージェントループの2回目のイテレーション（ツール呼び出し結果を含む継続リクエスト）で接続が切断される。

ブラウザコンソール:
```
POST https://127.0.0.1:19876/chat net::ERR_INCOMPLETE_CHUNKED_ENCODING 200 (OK)
```

Chat UIには「network error」が表示される。

## Investigation Steps

1. ユーザーがkimi-k2.5モデルでチャット送信 → ツール呼び出し完了 → network error
2. ブラウザコンソールで `ERR_INCOMPLETE_CHUNKED_ENCODING` を確認
3. `lsof -ti:19876` でサーバープロセスは生存を確認
4. サーバー再起動後、curlで同じリクエストを送信 → 正常完了
5. コード調査: エージェントループ内に try-catch が一切なかった

## Root Cause

`handleChat()` 内のエージェントループは `ReadableStream` の `pull()` コールバック内で実行される。ループの構造:

```
piStream() → for await (events) → s.result() → contextにpush → toolUseなら再ループ
```

2回目のイテレーション（ツール結果を含むメッセージでLLMを再呼び出し）で例外が発生した場合、`pull()` 内に try-catch がないため例外が `ReadableStream` 内部に伝播し、ストリームが破損状態になる。ストリームは正常に close されず、ブラウザ側では chunked encoding が不完全なまま終了する。

**核心**: `ReadableStream` の `pull()` コールバック内の未捕捉例外はストリーム全体を破壊する。通常の `Promise` reject とは異なり、ストリームの回復手段がない。

## Solution

### Before (broken)

```typescript
// エラーハンドリングなし — 例外がReadableStreamを破壊する
const s = piStream(model, context, {
  apiKey: config.openrouterApiKey,
  signal: abortController.signal,
  maxTokens: 4096,
});
for await (const event of s) {
  // handle events
}
const lastResult = await s.result();
```

### After (fixed)

```typescript
let lastResult;
try {
  const s = piStream(model, context, {
    apiKey: config.openrouterApiKey,
    signal: abortController.signal,
    maxTokens: 4096,
  });
  for await (const event of s) {
    // handle events
  }
  lastResult = await s.result();
} catch (streamErr) {
  const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
  console.error(`[chat] Stream error (step ${steps}):`, errMsg);
  sseEvent(controller, "error", { message: "LLMの応答中にエラーが発生しました" });
  break;
}
```

### Key Changes

1. **単一 try-catch でストリーム全体を保護** — 初期化・イテレーション・結果取得を一括で囲む。回復アクションは全ケース共通（ログ → SSEエラー送信 → break）なので、分割する意味がない。
2. **汎用エラーメッセージをクライアントに返す** — 内部詳細（スタックトレース、ライブラリエラー）はサーバーログのみに記録。
3. **`break` でループを抜ける** — 外側の `finally` ブロックが `controller.close()` を呼び、ストリームを正常終了させる。

## Prevention

### ReadableStream pull() 内のルール

- **`pull()` / `start()` 内の全コードを try-catch で囲む。例外なし。**
- **for-await ループは必ず try-catch の内側に置く。** ジェネレータの途中失敗はネットワーク断やタイムアウトで日常的に起きる。
- **全エラーパスで `controller.close()` が呼ばれることを保証する。** クライアントのハング防止。
- **エラーメッセージをサニタイズしてからSSEに送信する。** スタックトレース、APIキー断片、DB詳細は絶対に送らない。

### 新規ストリーミングエンドポイント追加チェックリスト

- [ ] `pull()` 内の全コードが try-catch で囲まれている
- [ ] 全エラーパスで `controller.close()` が呼ばれる
- [ ] エラーメッセージがサニタイズされている（内部詳細はサーバーログのみ）
- [ ] AbortController を外部API呼び出しに渡している
- [ ] タイムアウトが設定されている
- [ ] クライアント切断時にバックエンドストリームも abort される

## Related

- [SSEストリーミング+ツール呼び出しのメッセージ順序バグ](../integration-issues/sse-streaming-tool-use-message-ordering.md) — 同じエージェントループの別のバグ（tool_result の順序問題）
- [エージェントチャット機能計画](../../plans/2026-03-08-feat-agent-chat-plan.md)
- [bridge server 初期設計](../../plans/2026-03-04-feat-cmux-local-bridge-server-plan.md)
