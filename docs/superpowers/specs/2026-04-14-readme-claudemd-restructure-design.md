# README・CLAUDE.md 整理設計

## 概要

README.md・CLAUDE.md・AGENTS.md の役割を明確に再定義し、古い情報を更新する。

## 目的

- 各ファイルの対象読者と役割を一意にする
- README.md に残っている古い情報（Preact、Cloudflare Pages、旧env変数）を修正
- AGENTS.md のステータス定義を現行の8段階に更新
- CLAUDE.md からコマンド・構成ツリーを削除し、AIルールに集約

## ファイル役割定義

| ファイル | 対象 | 内容 |
|---------|------|------|
| README.md | 人間（開発者） | 概要・セットアップ・開発コマンド・デプロイ |
| CLAUDE.md | AIエージェント | コーディング規約・ステータス定義・D1注意点・APIルール |
| AGENTS.md | AIエージェント・API利用者 | REST APIリファレンス |

## README.md 変更内容

### 技術スタック（修正）
- `Preact SPA + @preact/signals` → `Next.js App Router + TanStack Query (Cloudflare Workers via @opennextjs/cloudflare)`
- CI/CDにフロントエンドデプロイ先を追記

### セットアップ（修正）
- 環境変数名: `VITE_API_TOKEN` → `NEXT_PUBLIC_API_TOKEN`
- `.env` → `.env.local`

### 開発コマンド（CLAUDE.mdから移動）
- バックエンド: `npm run dev` / `npm test` / `npm run typecheck`
- フロントエンド: `npm run dev` / `build` / `preview` / `deploy`

### プロジェクト構成（CLAUDE.mdから移動）
- ディレクトリツリーをREADMEに移す

### デプロイ（修正）
- `Cloudflare Pages` → `Cloudflare Workers (@opennextjs/cloudflare)`

### リンク追加
- API仕様: AGENTS.md
- 開発ガイド (AI向け): CLAUDE.md

## CLAUDE.md 変更内容

### 削除
- 開発コマンドセクション（→ README.md）
- プロジェクト構成ツリー（→ README.md）

### 保持
- 技術スタック（簡潔な1行概要）
- URLs
- コーディング規約（Conventional Commits・論理削除・2階層制限など）
- タスクステータス定義（8段階、各ステータスの意味）
- セッションステータス定義
- TanStack Query・APIルール
- D1マイグレーション注意点
- 環境変数

## AGENTS.md 変更内容

### ステータス定義（修正）
- 6段階 → 8段階: `backlog | todo | ready_for_code | in_progress | review | waiting | ready_for_publish | done`
- `waiting`・`ready_for_publish` の説明を追加

### TODO一覧クエリパラメータ（修正）
- `status` の選択肢に `waiting`・`ready_for_publish` を追加

### 環境変数名（修正）
- `TODO_API_TOKEN` → `API_TOKEN`（使用例のcurlコマンドも更新）

## 対象外

- CLAUDE.md のコーディング規約の内容変更（整理のみ）
- AGENTS.md のエンドポイント追加・削除
- その他ファイルの変更
