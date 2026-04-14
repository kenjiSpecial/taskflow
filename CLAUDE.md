# Taskflow

個人用タスク・スケジュール管理システム。Hono + D1 + Next.js on Cloudflare。

## 技術スタック

- **API**: Hono on Cloudflare Workers
- **DB**: Cloudflare D1 (SQLite)
- **Frontend**: Next.js App Router + TanStack Query (Cloudflare Workers via @opennextjs/cloudflare)
- **Auth**: Bearer Token
- **Test**: Vitest + @cloudflare/vitest-pool-workers
- **CI/CD**: GitHub Actions → main push で自動デプロイ

## URLs

- API: https://taskflow.kenji-draemon.workers.dev

## コーディング規約

- Conventional Commits + 日本語: `feat(scope): 説明`
- main直接push、ブランチ不要
- oxlint + oxfmt でリント・フォーマット
- Zodで全入力バリデーション
- D1はプリペアドステートメント必須（SQLi防止）
- 論理削除（`deleted_at`）、物理削除しない
- タスク階層は2階層まで（親-子のみ）
- タスクステータス: `backlog | todo | ready_for_code | in_progress | review | waiting | ready_for_publish | done`（8段階カンバンフロー。ready_for_code = AIコーディングエージェント着手可能、waiting = 外部ブロッカー待ち）
- セッションステータス: `active | paused | done`
- ログのsource: `human | ai`（UI経由=human、API直接/agent=ai）
- APIはUTC保存、フロントでJST変換

### TanStack Query・API ルール

- コンポーネントから `api.*` を直接呼ばない。必ずTanStack Queryフック経由
- ステータス変更等はOptimistic Update対応済み（`onMutate`でキャッシュ即時更新）
- D1のFK制約に依存しない。CREATE/UPDATEで `*_id` 参照先の存在チェック必須

### D1マイグレーション注意

- CHECK制約の変更はALTER TABLEで不可。テーブル再作成（CREATE新→INSERT SELECT→DROP旧→RENAME）が必要
- FK参照があるテーブルのDROPには `PRAGMA foreign_keys = OFF` が必要。`wrangler d1 execute --file` で一括実行すること（個別コマンドではセッションが分離される）
- **重要**: `wrangler d1 migrations apply --remote` はリモートでPRAGMAが無効になりFKエラーになる場合がある。その場合は `wrangler d1 execute taskflow-db --remote --file <migration.sql>` で実行し、その後 `INSERT INTO d1_migrations (name) VALUES ('<migration_name>')` で手動マーク

## 環境変数

- `.dev.vars` → ローカルバックエンド（`API_TOKEN`）
- `frontend/.env.local` → ローカルフロントエンド（`NEXT_PUBLIC_API_TOKEN`）
- 本番はCF Secrets / GitHub Secrets で管理
