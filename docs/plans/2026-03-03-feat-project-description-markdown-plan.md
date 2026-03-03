---
title: "feat: プロジェクト概要のマークダウン表示"
type: feat
status: active
date: 2026-03-03
---

# プロジェクト概要のマークダウン表示

## 問題

プロジェクト詳細ページの description が `<p>` タグ1行で表示され、改行・段落・見出し・リストが潰れて非常に読みづらい。

## 修正方針

軽量マークダウンパーサー `marked` を導入し、description をHTML変換して表示。Tailwind の `prose` クラス（`@tailwindcss/typography`）でタイポグラフィを整える。

### 導入パッケージ
- `marked` — 軽量マークダウンパーサー（~32KB gzipped）
- `@tailwindcss/typography` — `prose` クラスでマークダウンHTMLにダーク対応の美しいスタイルを適用

## 変更ファイル

1. **`ProjectHeader.tsx:57-59`** — `<p>{description}</p>` → `<div class="prose prose-invert prose-sm" dangerouslySetInnerHTML={marked(description)}>`
2. **`ProjectCell.tsx:192-194`** — MatrixView側も同様（ただし既に line-clamp で省略表示なのでプレーンテキスト維持 or 簡易改行のみでも可）

## Acceptance Criteria

- [ ] プロジェクト詳細ページの概要が見出し・段落・リスト・リンク・コードブロックで表示される
- [ ] ダーク背景でテキストが正しく見える（`prose-invert`）
- [ ] MatrixView のプロジェクトセル内は省略表示を維持（壊さない）
- [ ] XSS対策: `marked` の sanitize オプションまたは DOMPurify を検討

## 参照

- 現在の表示: `ProjectHeader.tsx:57-59`
- MatrixView側: `ProjectCell.tsx:192-194`
- API型定義: `api.ts:20` (`description: string | null`)
