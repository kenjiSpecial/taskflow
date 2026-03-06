---
title: "feat: セッション・プロジェクトのdescriptionマークダウン対応"
type: feat
status: completed
date: 2026-03-05
brainstorm: docs/brainstorms/2026-03-05-markdown-description-brainstorm.md
---

# セッション・プロジェクトのdescriptionマークダウン対応

## Overview

description/ログのテキスト表示をマークダウンレンダリングに置き換える。既存の `marked` + `@tailwindcss/typography` を活用し、共通 `MarkdownContent` コンポーネントで統一。DOMPurifyでXSS防御。

## 対象・非対象

| 箇所 | ファイル | 対応 |
|------|---------|------|
| プロジェクト詳細ヘッダ | `ProjectHeader.tsx:60-65` | ✅ 既存実装→共通化+DOMPurify追加 |
| セッションログ（インライン） | `SessionInlineDetail.tsx:217` | ✅ MD対応 |
| セッションログ（詳細パネル） | `SessionDetailPanel.tsx:157` | ✅ MD対応 |
| プロジェクトcell（マトリックス/カード） | `ProjectCell.tsx:218` | ❌ 対象外（line-clampとの相性問題） |

## 実装タスク

### Step 1: DOMPurifyインストール

```bash
cd frontend && npm install dompurify && npm install -D @types/dompurify
```

### Step 2: `MarkdownContent` コンポーネント新規作成

**ファイル**: `frontend/src/components/MarkdownContent.tsx`

```tsx
import { marked } from "marked";
import DOMPurify from "dompurify";

// モジュールレベルで設定（コンポーネント外）
marked.setOptions({ breaks: true });

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "p", "br", "strong", "em", "del",
    "ul", "ol", "li", "a", "code", "pre", "blockquote", "hr",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

interface Props {
  content: string | null | undefined;
  class?: string;
}

export function MarkdownContent({ content, class: className }: Props) {
  if (!content) return null;

  const raw = marked.parse(content) as string;
  const html = DOMPurify.sanitize(raw, PURIFY_CONFIG);

  return (
    <div
      class={`prose prose-invert prose-sm max-w-none ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

**設計ポイント**:
- `content` が null/undefined なら何も表示しない
- `class` prop で呼び出し側からスタイル追加可能
- `ALLOWED_TAGS` で画像・iframe・script等を明示的にブロック
- リンクは `ALLOWED_ATTR` で href のみ許可
- `breaks: true` で改行→`<br>` 変換（ログの作業メモに適合）
- `as string` キャスト: marked v17 のデフォルトは同期なので安全

### Step 3: ProjectHeader.tsx を共通化

**ファイル**: `frontend/src/components/project-detail/ProjectHeader.tsx:60-65`

Before:
```tsx
import { marked } from "marked";
marked.setOptions({ breaks: true });
// ...
<div
  class="prose prose-invert prose-sm max-w-none mt-1 pl-3 ml-1 text-app-text-muted"
  dangerouslySetInnerHTML={{ __html: marked.parse(project.description) as string }}
/>
```

After:
```tsx
import { MarkdownContent } from "../MarkdownContent";
// ...
<MarkdownContent
  content={project.description}
  class="mt-1 pl-3 ml-1 text-app-text-muted"
/>
```

- `marked` / `marked.setOptions` のインポート・呼び出しを削除
- DOMPurifyサニタイズが自動適用される（既存の穴を修正）

### Step 4: SessionInlineDetail.tsx のログ表示をMD化

**ファイル**: `frontend/src/components/SessionInlineDetail.tsx:217`

Before:
```tsx
<div class="session-log-content">{log.content}</div>
```

After:
```tsx
<MarkdownContent content={log.content} class="session-log-content-md" />
```

**CSS変更** (`global.css`): `.session-log-content-md` を追加。既存の `.session-log-content` の `white-space: pre-wrap` は不要になる（`<br>` / `<p>` で改行処理されるため）。font-size等は維持。

```css
.session-log-content-md {
  font-size: 0.875rem;
  line-height: 1.5;
}
```

### Step 5: SessionDetailPanel.tsx のログ表示をMD化

**ファイル**: `frontend/src/components/project-detail/SessionDetailPanel.tsx:157`

Before:
```tsx
<div class="text-sm whitespace-pre-wrap">{log.content}</div>
```

After:
```tsx
<MarkdownContent content={log.content} class="text-sm" />
```

`whitespace-pre-wrap` は削除（prose + `breaks: true` が改行を処理）。

### Step 6: prose スタイル調整

`global.css` にproseのカスタムスタイルを追加し、アプリのダークテーマ（CSS変数）と整合させる。

```css
/* マークダウンコンテンツのテーマ調整 */
.prose {
  --tw-prose-body: var(--text-muted);
  --tw-prose-headings: var(--text);
  --tw-prose-links: var(--accent);
  --tw-prose-code: var(--text);
}
```

## Acceptance Criteria

- [x] `MarkdownContent` コンポーネントが作成され、全対象箇所で使用されている
- [x] DOMPurifyでサニタイズされ、`<script>`, `<img>`, `<iframe>` 等が除去される
- [x] ProjectHeader の既存マークダウン実装が共通コンポーネントに置き換わる
- [x] セッションログがマークダウンで表示される（見出し・太字・リスト・コード・リンク）
- [x] `breaks: true` により単一改行が `<br>` として反映される
- [x] ダークテーマでテキスト色がアプリと整合する
- [x] ProjectCell（マトリックス/カード）は変更なし（プレーンテキスト維持）
- [x] 既存の動作が壊れていないこと

## References

- 既存MD実装: `ProjectHeader.tsx:60-65`
- ブレスト: `docs/brainstorms/2026-03-05-markdown-description-brainstorm.md`
- 先行計画: `docs/plans/2026-03-03-feat-project-description-markdown-plan.md`
- Preact Signals注意: `docs/solutions/ui-bugs/preact-signal-misuse-and-code-review-fixes.md`
