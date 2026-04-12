# Next.js移行 + タスク中心リデザイン

## 概要

TaskFlowのフロントエンドをPreact SPAからNext.js (App Router)に移行し、session中心のUIからtask中心のUIに再設計する。バックエンドAPI（Hono + D1）は維持。

## 動機

- タスクの進捗管理をメインにしたい（sessionは作業ログ的位置づけ）
- 各エンティティに個別ページを持たせ、紐づけ操作を明確にする
- LLMとの連携を容易にするプロンプトコピー機能の追加

## スコープ

- フロントエンドのフルリビルド（`frontend/`をNext.jsプロジェクトとして再構築）
- タスクステータスの拡張（5段階カンバンフロー）
- LLMプロンプトコピー機能の追加
- バックエンド: statusバリデーション・マイグレーションのみ更新

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js (App Router) |
| デプロイ | Cloudflare Pages (`@cloudflare/next-on-pages`) |
| UIライブラリ | React 19 |
| データフェッチ | TanStack Query |
| スタイリング | Tailwind CSS |
| バックエンド | Hono + D1 (変更なし) |
| Realtime | WebSocket + Durable Objects (変更なし) |

## データモデル変更

### タスクステータス拡張

現行: `pending | in_progress | completed`
新規: `backlog | todo | in_progress | review | done`

マイグレーション:
- `pending` → `backlog`
- `in_progress` → `in_progress`
- `completed` → `done`
- `completed_at` → `done_at` にリネーム

### エンティティ関係（変更なし）

- Task → Project: 多対1（`project_id`）
- Task → Task: 親子2階層（`parent_id`）
- Session → Project: 多対1（`project_id`）
- Session ↔ Task: 多対多（`session_tasks`）
- Session → SessionLog: 1対多
- Project ↔ Tag: 多対多（`project_tags`）
- Task ↔ Tag: 多対多（`todo_tags`）

## ページ構成

| パス | 内容 |
|-----|------|
| `/` | タスクカンバンボード（トップページ） |
| `/tasks/[id]` | タスク詳細・編集・紐づけ |
| `/projects` | プロジェクト一覧 |
| `/projects/[id]` | プロジェクト詳細（配下タスク・セッション） |
| `/sessions/[id]` | セッション詳細（ログ・リンクタスク） |

## ページデザイン

### トップページ: カンバンボード (`/`)

横スクロールの5カラムカンバンボード（Trello/Linear風）。

- カラム: Backlog → Todo → In Progress → Review → Done
- 各カラムにタスク件数バッジ
- タスクカードにはタイトル、プロジェクト名、セッション進行状態を表示
- ドラッグ&ドロップでステータス変更
- プロジェクト・タグによるフィルタリング
- ChatPanelは全ページ共通サイドバー

### タスク詳細 (`/tasks/[id]`)

2カラムレイアウト（メイン + サイドバー）。

**メインエリア:**
- ヘッダー: タイトル、ステータスセレクタ、LLMプロンプトコピーボタン、編集ボタン
- プロパティグリッド: プロジェクト（リンク）、優先度、期日、タグ
- サブタスク一覧: ステータスドット付きリスト
- セッション一覧: リンク中セッション + 最新ログプレビュー

**サイドバー:**
- プロジェクト変更セレクタ
- セッションリンク追加ボタン
- タグ追加ボタン

### プロジェクト詳細 (`/projects/[id]`)

**ヘッダー:** プロジェクト名、説明、カラードット、LLMプロンプトコピーボタン、編集ボタン

**統計カード:** タスク合計、進行中、完了、セッション数

**タスクリスト:** ステータスごとにグルーピング表示。Doneは折りたたみ。各タスクに優先度バッジ・期日表示。タスクはリンクで詳細ページへ遷移。

**セッション一覧:** リンクされたセッション、ステータス、リンクタスク数。

### セッション詳細 (`/sessions/[id]`)

タスク詳細ページと同様の2カラムレイアウト。

**メインエリア:**
- ヘッダー: タイトル、ステータス、LLMプロンプトコピーボタン
- セッションログ一覧（時系列）
- リンクされたタスク一覧

**サイドバー:**
- プロジェクト変更
- タスクリンク追加

## LLMプロンプトコピー機能

各エンティティページに「LLMプロンプトをコピー」ボタンを配置。クリックでMarkdown形式のプロンプトをクリップボードにコピーする。

### タスクプロンプト形式

```markdown
# タスク: {title}

- ステータス: {status}
- 優先度: {priority}
- プロジェクト: {project_name}
- 期日: {due_date}
- タグ: {tags}

## 説明
{description}

## サブタスク
- [ ] {child_title} ({child_status})
...

## リンク中のセッション
- {session_title} ({session_status}) - 最新ログ: {latest_log}
...
```

### プロジェクトプロンプト形式

```markdown
# プロジェクト: {name}

{description}

## タスク状況
- Backlog: {count}件
- Todo: {count}件
- In Progress: {count}件 ({task_titles})
- Review: {count}件
- Done: {count}件

## 進行中タスク詳細
### {task_title} [{priority}, 期日: {due_date}]
{task_description}
- サブタスク: {children}

## アクティブセッション
- {session_title} (タスク{count}件リンク)
```

### セッションプロンプト形式

```markdown
# セッション: {title}

- ステータス: {status}
- プロジェクト: {project_name}

## リンクタスク
- {task_title} ({task_status}, {priority})
...

## セッションログ
{logs in chronological order}
```

### 設計方針

- Markdown形式（LLMが構造的に読みやすい）
- 階層的に情報を含む（プロジェクトは配下タスクの詳細も含む）
- ステータス・優先度・期日など構造化データを網羅

## フロントエンドディレクトリ構成

```
frontend/
  app/
    layout.tsx              # 共通レイアウト（ChatPanel含む）
    page.tsx                # / → カンバンボード
    tasks/[id]/page.tsx     # タスク詳細
    projects/page.tsx       # プロジェクト一覧
    projects/[id]/page.tsx  # プロジェクト詳細
    sessions/[id]/page.tsx  # セッション詳細
  components/
    kanban/                 # カンバンボード関連
    task/                   # タスク詳細関連
    project/                # プロジェクト関連
    session/                # セッション関連
    chat/                   # ChatPanel
    common/                 # 共通UI（LLMCopyButton等）
  lib/
    api.ts                  # APIクライアント
    hooks/                  # カスタムhooks（TanStack Query wrappers）
  types/
    index.ts                # 型定義
```

## Realtime同期

既存のWebSocket（Durable Objects）基盤はそのまま維持。

- WSイベント受信時にTanStack Queryの該当queryをinvalidate
- クライアントID追跡で自身の変更によるエコーを防止（既存ロジック踏襲）

## バックエンド変更

最小限の変更のみ:

- `src/validators/`: todoのstatusバリデーションを `backlog | todo | in_progress | review | done` に更新
- `migrations/0008_update_todo_status.sql`: ステータスマイグレーション + `completed_at` → `done_at` リネーム
- `src/routes/todos.ts`: ステータス関連ロジックの更新
- `src/types.ts`: 型定義更新

## 既存機能の維持

- ChatPanel（LLMチャット）: 全ページ共通サイドバーとして維持
- Realtime同期: WebSocket + TanStack Query invalidationで維持
- タグ機能: プロジェクト・タスクへの紐づけ維持
- ドラッグ&ドロップ: カンバンボードでのステータス変更に活用
- 論理削除: 全エンティティで`deleted_at`パターン維持
- Bearer Token認証: 変更なし
