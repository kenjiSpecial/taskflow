# README・CLAUDE.md 整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** README.md・CLAUDE.md・AGENTS.md の役割を再定義し、古い情報を現在の実装に合わせて更新する。

**Architecture:** README（人間向け: 概要・セットアップ・コマンド・構成・デプロイ）/ CLAUDE.md（AI向け: 規約・ルール・注意点のみ）/ AGENTS.md（APIリファレンス）の3ファイルを役割ごとに整理する。コマンド・構成ツリーをCLAUDE.mdからREADME.mdへ移動。

**Tech Stack:** Markdown editing only（コード変更なし）

---

### Task 1: README.md を更新する

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README.md を以下の内容に書き換える**

`README.md` を次の内容で完全に置き換える:

```markdown
# Taskflow

個人用タスク・スケジュール管理システム。

## 技術スタック

- **API**: Hono on Cloudflare Workers
- **DB**: Cloudflare D1 (SQLite)
- **Frontend**: Next.js App Router + TanStack Query (Cloudflare Workers via @opennextjs/cloudflare)
- **Auth**: Bearer Token
- **Test**: Vitest + @cloudflare/vitest-pool-workers
- **CI/CD**: GitHub Actions → main push で自動デプロイ

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
```

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "docs(readme): Next.js・Workersへの移行を反映し開発コマンドを追加"
```

---

### Task 2: CLAUDE.md から開発コマンドとプロジェクト構成を削除する

**Files:**
- Modify: `CLAUDE.md`

現在の `CLAUDE.md` には以下の2セクションが含まれており、README.mdに移動するため削除する:
- `## 開発コマンド`（バックエンド・フロントエンドのコマンド一覧）
- `## プロジェクト構成`（ディレクトリツリー）

- [ ] **Step 1: `## 開発コマンド` セクションを削除する**

`CLAUDE.md` の以下のブロックを削除する（`## URLs` の次にある）:

```markdown
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
```

- [ ] **Step 2: `## プロジェクト構成` セクションを削除する**

`CLAUDE.md` の以下のブロックを削除する:

```markdown
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
```

- [ ] **Step 3: 削除後の `CLAUDE.md` を目視確認する**

削除後のセクション順序が正しいことを確認:
1. `# Taskflow`
2. `## 技術スタック`
3. `## URLs`
4. `## コーディング規約`（ここに直接続く）
5. `### TanStack Query・API ルール`
6. `### D1マイグレーション注意`
7. `## 環境変数`

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "docs(claude): 開発コマンドとプロジェクト構成をREADMEへ移動"
```

---

### Task 3: AGENTS.md のステータス定義・クエリパラメータ・env変数を更新する

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: `## ステータス` セクションのタスク定義を8段階に更新する**

現在の記述:

```markdown
### タスク（6段階カンバンフロー）

`backlog → todo → ready_for_code → in_progress → review → done`

- `backlog`: 未整理・いつかやる
- `todo`: 次やる
- `ready_for_code`: 仕様確定済み、AIコーディングエージェントが着手可能
- `in_progress`: 作業中
- `review`: レビュー待ち
- `done`: 完了
```

を以下に置き換える:

```markdown
### タスク（8段階カンバンフロー）

`backlog → todo → ready_for_code → in_progress → review → waiting → ready_for_publish → done`

- `backlog`: 未整理・いつかやる
- `todo`: 次やる
- `ready_for_code`: 仕様確定済み、AIコーディングエージェントが着手可能
- `in_progress`: 作業中
- `review`: レビュー待ち
- `waiting`: 外部ブロッカー待ち（レビュー・承認・依存解消など）
- `ready_for_publish`: 実装完了、公開・リリース待ち
- `done`: 完了
```

- [ ] **Step 2: TODO一覧の `status` クエリパラメータに `waiting`・`ready_for_publish` を追加する**

現在の記述（パラメータセクション）:

```markdown
- `status`: backlog | todo | ready_for_code | in_progress | review | done
```

を以下に置き換える:

```markdown
- `status`: backlog | todo | ready_for_code | in_progress | review | waiting | ready_for_publish | done
```

- [ ] **Step 3: 使用例の環境変数名を修正する**

ファイル内の全ての `$TODO_API_TOKEN` を `$API_TOKEN` に置き換える。

変更対象箇所（複数行）:
```bash
curl -H "Authorization: Bearer $TODO_API_TOKEN" ...
```
↓
```bash
curl -H "Authorization: Bearer $API_TOKEN" ...
```

また、ファイル冒頭の設定例:
```bash
export TODO_API_TOKEN="your-token-here"
```
↓
```bash
export API_TOKEN="your-token-here"
```

- [ ] **Step 4: コミット**

```bash
git add AGENTS.md
git commit -m "docs(agents): ステータスを8段階に更新しenv変数名を修正"
```
