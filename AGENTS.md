# TODO Manager API

## 概要

個人用TODOマネージャーのREST API。Hono + Cloudflare Workers + D1。

## 認証

Bearer Token認証。リクエストヘッダーに `Authorization: Bearer <TOKEN>` を含める。

```bash
export TODO_API_TOKEN="your-token-here"
```

## Base URL

- Production: `https://todo-manager.<your-subdomain>.workers.dev`
- Development: `http://localhost:8787`

## エンドポイント

### ヘルスチェック（認証不要）

```bash
GET /health
```

### TODO一覧

```bash
GET /api/todos
GET /api/todos?status=pending&priority=high&project=work&sort=due_date&order=asc&limit=50&offset=0
```

パラメータ:
- `status`: pending | in_progress | completed
- `priority`: high | medium | low
- `project`: プロジェクト名
- `sort`: due_date | priority | created_at | sort_order (default: created_at)
- `order`: asc | desc (default: desc)
- `limit`: 1-100 (default: 50)
- `offset`: 0~ (default: 0)

### TODO詳細（子タスク含む）

```bash
GET /api/todos/:id
```

### TODO作成

```bash
POST /api/todos
Content-Type: application/json

{
  "title": "タスク名",
  "description": "詳細説明（任意）",
  "status": "pending",
  "priority": "high",
  "due_date": "2026-03-01",
  "project": "work",
  "parent_id": "親タスクID（任意）",
  "sort_order": 0
}
```

必須: `title` のみ。他はデフォルト値あり。

### TODO更新

```bash
PATCH /api/todos/:id
Content-Type: application/json

{
  "status": "completed"
}
```

部分更新。指定したフィールドのみ更新。

### TODO削除（論理削除）

```bash
DELETE /api/todos/:id
```

親タスク削除時、子タスクも論理削除される。

### 今日のTODO

```bash
GET /api/todos/today?timezone=Asia/Tokyo
```

### プロジェクト一覧

```bash
GET /api/projects
```

## 使用例

```bash
# 一覧取得
curl -H "Authorization: Bearer $TODO_API_TOKEN" http://localhost:8787/api/todos

# 作成
curl -X POST -H "Authorization: Bearer $TODO_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"レポートを書く","priority":"high","due_date":"2026-03-01"}' \
  http://localhost:8787/api/todos

# 完了にする
curl -X PATCH -H "Authorization: Bearer $TODO_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed"}' \
  http://localhost:8787/api/todos/<id>

# 削除
curl -X DELETE -H "Authorization: Bearer $TODO_API_TOKEN" http://localhost:8787/api/todos/<id>
```
