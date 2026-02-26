# Taskflow

個人用タスク・スケジュール管理システム。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| API | Hono on Cloudflare Workers |
| DB | Cloudflare D1 (SQLite) |
| Frontend | Preact SPA + @preact/signals |
| CI/CD | GitHub Actions |

## セットアップ

```bash
# バックエンド
npm install
cp .dev.vars.example .dev.vars  # API_TOKEN を設定
npx wrangler d1 migrations apply taskflow-db --local
npm run dev

# フロントエンド
cd frontend
npm install
cp .env.example .env  # VITE_API_TOKEN を設定
npm run dev
```

ブラウザで http://localhost:5173 を開く。

## デプロイ

`main` ブランチにpushすると GitHub Actions で自動デプロイ。

- API → Cloudflare Workers
- Frontend → Cloudflare Pages

## API

詳細は [AGENTS.md](AGENTS.md) を参照。

```bash
GET    /health                 ヘルスチェック
GET    /api/todos              一覧（フィルタ・ソート対応）
GET    /api/todos/:id          詳細（子タスク含む）
POST   /api/todos              作成
PATCH  /api/todos/:id          更新
DELETE /api/todos/:id          論理削除
GET    /api/todos/today        今日のTODO
GET    /api/projects           プロジェクト一覧
```
