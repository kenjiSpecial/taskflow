# チャット会話ログ永続化

## 目的

チャットパネルの会話をDBに自動保存し、ブラウザリロード後も会話履歴を復元できるようにする。会話ログは資産として蓄積する。

## 前提

バックエンド（DB + REST API）は完成済み。フロントエンド接続のみが必要。

- DB: `chat_conversations`, `chat_messages` テーブル (migration 0007)
- API: `src/routes/chat.ts` — 会話CRUD + メッセージ追加
- bridge.ts — LLMサーバーへの接続。永続化には関与しない（変更なし）

## アーキテクチャ

```
ユーザー入力 → ChatPanel → bridgeChat() → LLMサーバー(SSE)
                  ↓ (保存)
              api.ts → REST API(/api/chat/*) → D1(chat_conversations, chat_messages)
```

- **bridgeサーバー**: LLM推論とツール実行のみ担当。永続化に関与しない
- **REST API**: 会話・メッセージのCRUD担当。ChatPanelから直接呼び出す
- bridgeの`conversation_id`パラメータは使わない（bridgeは永続化を知らない）

## データモデル

### DB → フロントエンド型マッピング

DBの`chat_messages`は全roleを1テーブルに保存する。フロントのUI表示用型(`ChatMessage`)とDB保存用は分離する。

```typescript
// DB保存用（api.ts経由でREST APIに送る）
interface ChatMessagePayload {
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  tool_calls?: string;    // JSON文字列: [{tool_name, args}]
  tool_call_id?: string;
  tool_name?: string;
}

// UI表示用（既存。変更なし）
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}
```

復元時: DBレコード → `role`で分岐:
- `user`/`assistant`: `ChatMessage`としてmessages stateに追加
- `assistant`(tool_calls付き) + `tool`: `ToolExecution`としてtoolExecutions stateに追加（statusはdone）

## 保存フロー

1. **会話作成**: 初回メッセージ送信時、bridgeChat()呼び出し前に:
   - `POST /api/chat/conversations` で会話作成 → `conversation_id` 取得
   - `localStorage`に`conversation_id`を保存
   - `POST /api/chat/conversations/:id/messages` でユーザーメッセージ保存
2. **以降のメッセージ保存**: 各イベント完了時に即保存
   - ユーザー送信時: `{role: "user", content: text}`
   - アシスタント応答完了時(`onDone`): `{role: "assistant", content: fullText}`
   - ツール呼び出し時(`onToolCall`): `{role: "assistant", tool_calls: JSON([{tool_name, args}]), tool_call_id}`
   - ツール結果時(`onToolResult`): `{role: "tool", tool_call_id, tool_name, content: JSON(result)}`
3. **保存はfire-and-forget**: 保存失敗してもチャットUIは止めない

## 復元フロー

1. マウント時に`localStorage`から`conversation_id`を取得
2. 存在すれば `GET /api/chat/conversations/:id/messages` でロード
3. レコードをroleで分岐してstate展開:
   - `user`/`assistant`(content付き) → `messages` stateに追加
   - `assistant`(tool_calls付き) → `toolExecutions` stateに`{status: "done"}`として追加
   - `tool` → 対応する`toolExecution`のresultを更新
4. 復元失敗時（404等）→ `localStorage`クリア、空の会話で開始

## 新しい会話

- 「新しい会話」ボタン押下時:
  - `localStorage`の`conversation_id`をクリア（**会話自体は削除しない**、DBに残る）
  - `messages`, `toolExecutions` stateをリセット
  - 次のメッセージ送信で新しい会話が自動作成される（保存フロー step 1）

## UIの変更

なし。既存UIのまま、裏で自動保存・復元する。

## 変更ファイル

- `frontend/lib/api.ts` — チャットAPI関数追加:
  - `createConversation(title?)` → `POST /api/chat/conversations`
  - `addChatMessage(conversationId, payload)` → `POST /api/chat/conversations/:id/messages`
  - `fetchChatMessages(conversationId)` → `GET /api/chat/conversations/:id/messages`
- `frontend/lib/hooks/useChat.ts` — 新規。永続化ロジックをカスタムフックに分離:
  - `conversationId` state管理
  - `saveMessage()` — fire-and-forget保存
  - `loadConversation()` — 復元ロジック
- `frontend/components/chat/ChatPanel.tsx` — useChatフック統合

## 変更しないファイル

- バックエンド（API, DB, validators）
- `frontend/lib/bridge.ts`

## 検証

1. メッセージ送信 → `wrangler d1 execute --remote taskflow-db --command "SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5"` でDB保存確認
2. ページリロード → 会話が復元される
3. ツール実行 → tool_calls/tool結果がDBに保存される
4. 「新しい会話」→ stateリセット、次の送信で新会話作成、旧会話はDBに残存
5. 保存API失敗時 → チャットUIは正常動作を継続
