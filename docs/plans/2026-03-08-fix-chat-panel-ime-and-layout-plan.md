---
title: "fix: チャットパネルIME対応とレイアウト改善"
type: fix
status: active
date: 2026-03-08
---

# fix: チャットパネルIME対応・レイアウト改善・Markdown表示

3つの問題を修正:
1. IME変換確定のEnterでメッセージが送信される
2. チャットパネルがオーバーレイ → サイドパネル+メインビュー縮小に変更
3. アシスタントの応答をMarkdown→HTMLに変換して表示

## Acceptance Criteria

- [ ] IME変換中のEnterでメッセージが送信されない (`isComposing`チェック)
- [ ] チャットパネルはデフォルトで開いた状態
- [ ] パネル表示時、メインビューが左にスライドし縮小される（オーバーレイではない）
- [ ] パネル閉じるとメインビューがフル幅に戻る
- [ ] モバイル（<768px）では従来通りフルスクリーンオーバーレイ
- [ ] アシスタントの応答がMarkdown→HTMLに変換されて表示される（コードブロック、リスト、太字等）

## 修正箇所

### 1. IME対応 — `ChatPanel.tsx:193-198`

```tsx
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    handleSend();
  }
};
```

`e.isComposing`チェック追加のみ。

### 2. レイアウト変更 — `app.tsx` + `global.css` + `chat-store.ts`

**app.tsx**: `app-container`にchat-open状態のクラスを付与

```tsx
<div class={`app-container ${isChatOpen.value ? "chat-open" : ""}`}>
  {/* routes */}
  <ChatPanel />
</div>
```

**global.css**: チャットパネルをfixed → flexレイアウトに変更

- `.app-container` をflex化、`.app-container.chat-open`でメインビューが縮小
- `.chat-panel` を `position: fixed` → flexアイテムに変更（width: 400px固定）
- メインコンテンツ側は `flex: 1; min-width: 0; transition: all 0.3s`
- モバイルは従来通りfixed overlay

**chat-store.ts**: `isChatOpen`のデフォルト値を`true`に変更

### 3. Markdown表示 — `ChatPanel.tsx` + 新規依存

`marked`（軽量Markdownパーサー）を使い、assistantメッセージのcontentをHTML化。

```tsx
// MessageBubble内
<div
  class="chat-message-content chat-markdown"
  dangerouslySetInnerHTML={{ __html: marked(msg.content) }}
/>
```

**CSS**: `.chat-markdown`にMarkdown用スタイル（コードブロック、リスト、見出し等）を追加。

### 4. チャットトグルボタン

パネル閉じた時のみ表示（現状維持）。パネル内の閉じるボタンも維持。

## References

- `frontend/src/components/ChatPanel.tsx:193` — handleKeyDown
- `frontend/src/styles/global.css:1678` — .chat-panel CSS
- `frontend/src/app.tsx:24` — ChatPanel mounting
- `frontend/src/stores/chat-store.ts:32` — isChatOpen signal
