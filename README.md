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
# 依存インストール
npm install
cd frontend && pnpm install

# 環境変数
cp .dev.vars.example .dev.vars          # API_TOKEN を設定
cp frontend/.env.example frontend/.env.local  # NEXT_PUBLIC_API_TOKEN を設定

# D1マイグレーション（リモート）
npx wrangler d1 migrations apply taskflow-db --remote
```

> DBはCloudflare上のリモートD1を使用。ローカルD1は使わない。

## 開発コマンド

### 一括起動（推奨）

```bash
npm run dev:all    # mprocs で backend + frontend + tf-agent を一括起動
```

[mprocs](https://github.com/pvolok/mprocs) で以下の3プロセスを同時起動する:

| プロセス | コマンド | ポート |
|---------|---------|-------|
| backend | `wrangler dev --remote` | 8787 |
| frontend | `pnpm dev` (Next.js) | 5173 |
| tf-agent | Bun サーバー（別リポジトリ） | 4300 |

ブラウザで http://localhost:5173 を開く。

### 個別起動

```bash
npm run dev                        # wrangler dev (port 8787) ※--remote なしだとローカルD1
npx wrangler dev --remote          # リモートD1に接続する場合
cd frontend && pnpm dev            # next dev (port 5173)
```

### ビルド・デプロイ

```bash
cd frontend && pnpm build          # next build
cd frontend && pnpm preview        # opennextjs-cloudflare preview
cd frontend && pnpm deploy         # opennextjs-cloudflare deploy
```

### テスト・品質

```bash
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint
npm run format       # oxfmt
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
