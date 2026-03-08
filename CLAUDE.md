# Taskflow

個人用タスク・スケジュール管理システム。Hono + D1 + Preact on Cloudflare。

## 技術スタック

- **API**: Hono on Cloudflare Workers
- **DB**: Cloudflare D1 (SQLite)
- **Frontend**: Preact SPA + @preact/signals (Vite)
- **Auth**: Bearer Token
- **Test**: Vitest + @cloudflare/vitest-pool-workers
- **CI/CD**: GitHub Actions → main push で自動デプロイ

## URLs

- API: https://taskflow.kenji-draemon.workers.dev

## 開発コマンド

```bash
# バックエンド
npm run dev          # wrangler dev (port 8787)
npm test             # vitest run
npm run typecheck    # tsc --noEmit

# フロントエンド
cd frontend && npm run dev    # vite (port 5173)
cd frontend && npm run build  # ビルド
```

## プロジェクト構成

```
src/                  # Hono API (Workers)
  index.ts            # アプリエントリ
  types.ts            # AppEnv型
  middleware/          # auth, cors, error
  routes/             # todos, projects
  validators/         # Zodスキーマ
  lib/                # DBヘルパー
frontend/src/         # Preact SPA (Pages)
  stores/             # @preact/signals
  components/         # UI コンポーネント
  lib/                # API クライアント
migrations/           # D1 SQL マイグレーション
test/                 # Vitest テスト
```

## コーディング規約

- Conventional Commits + 日本語: `feat(scope): 説明`
- main直接push、ブランチ不要
- oxlint + oxfmt でリント・フォーマット
- Zodで全入力バリデーション
- D1はプリペアドステートメント必須（SQLi防止）
- 論理削除（`deleted_at`）、物理削除しない
- タスク階層は2階層まで（親-子のみ）
- APIはUTC保存、フロントでJST変換

### Preact Signals ルール

- コンポーネント内: `useComputed()` / `useSignal()` を使用
- モジュールレベル（store等）: `computed()` / `signal()` を使用
- コンポーネント内で `computed()` / `signal()` を使わない（メモリリーク）

### ストア・API ルール

- コンポーネントから `api.*` を直接呼ばない。必ずストア経由
- D1のFK制約に依存しない。CREATE/UPDATEで `*_id` 参照先の存在チェック必須

## 環境変数

- `.dev.vars` → ローカルバックエンド（`API_TOKEN`）
- `frontend/.env` → ローカルフロントエンド（`VITE_API_TOKEN`）
- 本番はCF Secrets / GitHub Secrets で管理
