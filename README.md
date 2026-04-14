# Taskflow

個人用タスク・スケジュール管理システム。

## 技術スタック

- **API**: Hono on Cloudflare Workers
- **DB**: Cloudflare D1 (SQLite)
- **Frontend**: Next.js App Router + TanStack Query (Cloudflare Workers via @opennextjs/cloudflare)
- **Auth**: Bearer Token
- **Test**: Vitest + @cloudflare/vitest-pool-workers
- **CI/CD**: GitHub Actions → main push で自動デプロイ

## URLs

- API: https://taskflow.kenji-draemon.workers.dev

## セットアップ

```bash
# バックエンド
npm install
cp .dev.vars.example .dev.vars  # API_TOKEN を設定
npx wrangler d1 migrations apply taskflow-db --local
npm run dev

# フロントエンド
cd frontend && npm install
cp .env.example .env.local  # NEXT_PUBLIC_API_TOKEN を設定
cd frontend && npm run dev
```

ブラウザで http://localhost:5173 を開く。

## 開発コマンド

```bash
# バックエンド
npm run dev          # wrangler dev (port 8787)
npm test             # vitest run
npm run typecheck    # tsc --noEmit

# フロントエンド
cd frontend && npm run dev      # next dev (port 5173)
cd frontend && npm run build    # next build
cd frontend && npm run preview  # opennextjs-cloudflare preview
cd frontend && npm run deploy   # opennextjs-cloudflare deploy
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
frontend/              # Next.js App Router (Cloudflare Workers)
  app/                 # ページ (/, /tasks/[id], /projects, etc.)
  components/          # UIコンポーネント
  lib/                 # APIクライアント、hooks、型定義
migrations/           # D1 SQL マイグレーション
test/                 # Vitest テスト
```

## デプロイ

`main` ブランチにpushすると GitHub Actions で自動デプロイ。

- API → Cloudflare Workers
- Frontend → Cloudflare Workers (@opennextjs/cloudflare)

## 関連ドキュメント

- [API仕様](AGENTS.md)
- [開発ガイド (AI向け)](CLAUDE.md)
