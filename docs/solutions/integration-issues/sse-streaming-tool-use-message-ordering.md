---
title: "SSEストリーミングでのメッセージ順序バグ: tool_resultがassistantメッセージより先にpushされる"
date: 2026-03-08
category: integration-issues
tags:
  - sse
  - streaming
  - tool-use
  - message-ordering
  - pi-ai
  - openrouter
severity: critical
component: taskflow-cmux-server (bridge server)
symptoms:
  - "API error: 'unexpected tool_use_id found in tool_result blocks'"
  - ツール実行後の2回目のLLMコールが失敗する
  - ストリーミング+ツール呼び出しの組み合わせでのみ発生
root_cause: >
  SSEストリーミングループ内でtool_resultを即座にcontext.messagesへpushしていたが、
  tool_useブロックを含むassistantメッセージはループ完了後にpushされていた。
  APIはassistant(tool_use) → tool_resultの順序を要求するため、順序違反でエラー発生。
---

# SSEストリーミングでのメッセージ順序バグ

## Problem

pi-ai (`@mariozechner/pi-ai`) を使ったSSEストリーミング+ツール呼び出しで、Anthropic API（OpenRouter経由）が以下のエラーを返す:

> unexpected tool_use_id found in tool_result blocks: each tool_result block must have a corresponding tool_use block in the previous message

ツール呼び出し自体は成功するが、ツール結果を踏まえた2回目のLLMコール（応答生成）が失敗する。

## Root Cause

`piStream()` のasync iteratorは `toolcall_end` イベントをストリーミング中にyieldする。このイベントハンドラ内でツールを実行し、`context.messages.push({ role: "toolResult", ... })` していた。

一方、tool_useブロックを含むassistantメッセージは `await s.result()` でストリーム完了後に取得される。これが `context.messages.push(lastResult)` でtool_resultの**後に**追加されていた。

```
実際の順序:  [user] → [toolResult] → [assistant(tool_use)]
期待される順序: [user] → [assistant(tool_use)] → [toolResult]
```

## Solution

tool_resultを即座にpushせず、`pendingToolResults` 配列に蓄積。assistantメッセージをpushした後にflushする。

### Before (broken)

```typescript
for await (const event of s) {
  if (event.type === "toolcall_end") {
    const result = await executeTool(toolCall.name, toolCall.arguments);
    context.messages.push({           // WRONG: assistantメッセージより先にpush
      role: "toolResult",
      toolCallId: toolCall.id,
      content: [{ type: "text", text: JSON.stringify(result) }],
    });
  }
}
const lastResult = await s.result();
context.messages.push(lastResult);    // assistantメッセージがtoolResultの後
```

### After (fixed)

```typescript
const pendingToolResults: Message[] = [];

for await (const event of s) {
  if (event.type === "toolcall_end") {
    const result = await executeTool(toolCall.name, toolCall.arguments);
    pendingToolResults.push({         // 蓄積のみ、pushしない
      role: "toolResult",
      toolCallId: toolCall.id,
      content: [{ type: "text", text: JSON.stringify(result) }],
    });
  }
}

const lastResult = await s.result();
context.messages.push(lastResult);    // assistant(tool_use) FIRST
for (const tr of pendingToolResults) {
  context.messages.push(tr);          // toolResult(s) AFTER
}
```

## Prevention

### 原則: "Finalize before appending"

ストリーミングイベントは**UIレンダリング専用**。会話コンテキスト（messages配列）の変更は、assistantメッセージが確定してから行う。

### エージェントループ実装チェックリスト

- [ ] `messages.push()` が `for await` ループ内にないこと
- [ ] ツール実行がassistantメッセージ確定後に行われること
- [ ] tool_resultのpushがassistantメッセージのpush後であること
- [ ] ライブラリ更新時にメッセージ順序テストを再実行すること

### LLMライブラリ別の注意点

| ライブラリ | 罠 | 対策 |
|---|---|---|
| pi-ai (`stream()`) | iteratorとresult()が分離。イベント中のpushは順序違反 | `await s.result()` 後にのみmessages変更 |
| Vercel AI SDK | `onToolCall`がストリーム中に発火 | 結果を蓄積、fullStream完了後にappend |
| Anthropic SDK | `stream.on('contentBlock')`が部分的 | `await stream.finalMessage()` を待つ |

### テスト方法

result()が遅延するモックを作成し、tool_resultが先にpushされないことをassertする。

## Related Files

- `taskflow-cmux-server.ts:334-443` - エージェントループ（修正箇所）
- `agent-tools.ts` - 17個のツール定義
- `frontend/src/lib/bridge.ts` - SSEクライアント

## Additional Fixes in Same Session

| 問題 | 修正 |
|------|------|
| IME変換Enterで送信 | `!e.isComposing` チェック追加 (`ChatPanel.tsx`) |
| チャットパネルがオーバーレイ | CSS Grid 2カラム + sticky side panel |
| CORS (port 5174) | Workers API + ブリッジサーバーの両方にorigin追加 |
| Markdown未レンダリング | `marked`ライブラリ導入、assistant応答をHTML化 |
| deploy.yml (master→main) | GitHub Actions trigger branch変更 + default branch変更 |
