# Taskflow API

## 概要

個人用タスク・スケジュール管理のREST API。Hono + Cloudflare Workers + D1。

## 認証

Bearer Token認証。リクエストヘッダーに `Authorization: Bearer <TOKEN>` を含める。

```bash
export TODO_API_TOKEN="your-token-here"
```

## Base URL

- Production: `https://taskflow.kenji-draemon.workers.dev`
- Development: `http://localhost:8787`

## エンドポイント

### ヘルスチェック（認証不要）

```bash
GET /health
```

### TODO一覧

```bash
GET /api/todos
GET /api/todos?status=backlog&priority=high&project_id=xxx&sort=due_date&order=asc&limit=50&offset=0
```

パラメータ:
- `status`: backlog | todo | ready_for_code | in_progress | review | done
- `priority`: high | medium | low
- `project_id`: プロジェクトID
- `sort`: due_date | priority | created_at | sort_order (default: sort_order)
- `order`: asc | desc (default: asc)
- `limit`: 1-1000 (default: 50)
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
  "status": "backlog",
  "priority": "high",
  "due_date": "2026-03-01",
  "project_id": "プロジェクトID（任意）",
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
  "status": "done"
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

### タスクログ一覧

```bash
GET /api/todos/:id/logs?order=asc&limit=50&offset=0
```

### タスクログ追加

```bash
POST /api/todos/:id/logs
Content-Type: application/json

{
  "content": "Markdown対応のログ内容",
  "source": "ai"
}
```

source: `human`（デフォルト）| `ai`。UI経由はhuman、エージェント経由はaiを指定。

### プロジェクト一覧

```bash
GET /api/projects
```

### プロジェクト詳細

```bash
GET /api/projects/:id
```

### プロジェクト作成

```bash
POST /api/projects
Content-Type: application/json

{
  "name": "プロジェクト名",
  "description": "説明（任意）",
  "color": "#ff6b6b（任意）"
}
```

### プロジェクト更新

```bash
PATCH /api/projects/:id
```

### セッション一覧

```bash
GET /api/sessions?status=active&project_id=xxx
```

### セッション作成

```bash
POST /api/sessions
Content-Type: application/json

{
  "title": "セッションタイトル",
  "description": "説明（任意）",
  "project_id": "プロジェクトID（任意）"
}
```

### セッション更新

```bash
PATCH /api/sessions/:id
```

### セッションタスク一覧

```bash
GET /api/sessions/:id/tasks
```

### タスクをセッションにリンク

```bash
POST /api/sessions/:id/tasks
Content-Type: application/json

{
  "todo_id": "タスクID"
}
```

### セッションログ追加

```bash
POST /api/sessions/:id/logs
Content-Type: application/json

{
  "content": "ログ内容",
  "source": "ai"
}
```

source: `human`（デフォルト）| `ai`

### タグ一覧

```bash
GET /api/tags
```

### タグ作成

```bash
POST /api/tags
Content-Type: application/json

{
  "name": "タグ名",
  "color": "#ff6b6b（任意）"
}
```

## ステータス

### タスク（6段階カンバンフロー）

`backlog → todo → ready_for_code → in_progress → review → done`

- `backlog`: 未整理・いつかやる
- `todo`: 次やる
- `ready_for_code`: 仕様確定済み、AIコーディングエージェントが着手可能
- `in_progress`: 作業中
- `review`: レビュー待ち
- `done`: 完了

### セッション

`active | paused | done`

## 使用例

```bash
# 一覧取得
curl -H "Authorization: Bearer $TODO_API_TOKEN" https://taskflow.kenji-draemon.workers.dev/api/todos

# 作成
curl -X POST -H "Authorization: Bearer $TODO_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"レポートを書く","priority":"high","due_date":"2026-03-01"}' \
  https://taskflow.kenji-draemon.workers.dev/api/todos

# ステータス変更
curl -X PATCH -H "Authorization: Bearer $TODO_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"done"}' \
  https://taskflow.kenji-draemon.workers.dev/api/todos/<id>

# タスクログ追加（AI経由）
curl -X POST -H "Authorization: Bearer $TODO_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"実装完了","source":"ai"}' \
  https://taskflow.kenji-draemon.workers.dev/api/todos/<id>/logs

# 削除
curl -X DELETE -H "Authorization: Bearer $TODO_API_TOKEN" https://taskflow.kenji-draemon.workers.dev/api/todos/<id>
```
