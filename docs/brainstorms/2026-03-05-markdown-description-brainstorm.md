# マークダウン対応: セッション・プロジェクトのdescription表示

**日付**: 2026-03-05
**ステータス**: 確定

## 何を作るか

セッションやプロジェクトのdescriptionフィールドで、現在プレーンテキストとして表示されている部分をマークダウンレンダリングに対応させる。

## なぜこのアプローチか

- `marked` ライブラリと `@tailwindcss/typography` が既にプロジェクトに導入済み
- 共通コンポーネント化でDRY・サニタイズを一箇所で管理
- DOMPurifyで堅牢なXSS対策

## キーデシジョン

### スコープ: 全箇所まとめて対応

対象コンポーネント:
- `ProjectCell.tsx` — プロジェクトdescription（マトリックス/カード）
- `SessionInlineDetail.tsx` — セッションログcontent
- `SessionDetailPanel.tsx` — セッション詳細
- `ProjectHeader.tsx` — プロジェクトヘッダのdescription

### アプローチ: 共通 `MarkdownContent` コンポーネント

- `frontend/src/components/MarkdownContent.tsx` を新規作成
- `marked()` でパース → `DOMPurify.sanitize()` → `dangerouslySetInnerHTML`
- Tailwind `prose` クラスでスタイリング
- 各表示箇所で `<MarkdownContent content={description} />` に置き換え

### マークダウンサポート範囲: 基本的な書式

対応:
- 見出し（h1-h3）
- 太字、イタリック
- リスト（箇条書き・番号付き）
- コード（インライン・ブロック）
- リンク
- 引用

非対応（サニタイズで除去）:
- 画像
- HTML直書き
- iframe, script等

### XSS対策: DOMPurify

- `dompurify` パッケージを追加インストール
- 許可タグ・属性をホワイトリストで制限
- リンクは `target="_blank"` + `rel="noopener noreferrer"` を自動付与

## オープンクエスチョン

なし
