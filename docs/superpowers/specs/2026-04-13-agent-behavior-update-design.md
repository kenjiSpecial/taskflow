# アシスタントエージェント挙動アップデート

## 目的

エージェントの知識を最新のTaskFlow仕様に合わせ、ページコンテキストに応じたプロアクティブな提案ができるようにする。

## 変更内容

### 1. システムプロンプト刷新

`taskflow-cmux-server.ts` の `buildSystemPrompt()` を書き換え。

**構成:**
- ロール定義: TaskFlowタスク管理アシスタント、日本語で簡潔に応答
- ステータスフロー: `backlog → todo → in_progress → review → done` の5段階を明示
- タスクログ活用: 重要な操作後に `add_todo_log`(source=ai) で記録を残す
- ページコンテキスト応答: ViewContext付き・ユーザー入力なしの場合、ページに応じたできることリストを提案
- タスク作成ルール: プロジェクト・セッション紐付け確認（現行維持）
- 操作ルール: 削除慎重、結果簡潔、複数操作は順次実行

**ページ別提案テンプレート:**
- カンバン(`/`): タスク作成、ステータス変更、フィルタ相談
- タスク詳細(`/tasks/*`): ステータス変更、ログ追加、子タスク作成、セッション紐付け
- プロジェクト(`/projects/*`): タスク追加、セッション管理、進捗確認
- セッション(`/sessions/*`): タスクリンク、ログ追加、ステータス変更

### 2. ページ切替時の自動挨拶

**フロー:**
1. ChatPanelが `usePathname()` でルート変更を検知
2. ルートからViewContextを構築（currentPage, activeProjectId等）
3. ViewContext付き・空メッセージでbridgeChat()を呼び出し
4. エージェントがページに応じた提案を返す
5. 提案はassistantメッセージとしてUIに表示

**実装:**
- `ChatPanel.tsx`: `usePathname()` を追加、パス変更時にauto-greet実行
- `bridge.ts`: ViewContext引数をbridgeChat()に渡す（既にoptions.contextとして対応済み）
- 新しい会話開始時のみ自動挨拶（既にメッセージがある場合はスキップ）

### 3. ViewContext構築

ChatPanelの親またはChatPanel自体でルートからコンテキストを構築:

```
/                → { currentPage: "kanban" }
/tasks/[id]      → { currentPage: "task-detail" }
/projects/[id]   → { currentPage: "project-detail", activeProjectId: id }
/sessions/[id]   → { currentPage: "session-detail" }
```

タスク名やプロジェクト名はページコンポーネントからprops経由で渡すのは複雑なため、エージェントがツールで取得する（get_todo, get_project等）。

### 4. ツール説明改善

`agent-tools.ts` の既存ツール説明を更新:
- `add_todo_log`: 「操作後の記録に積極的に使う。エージェント経由ならsource=aiを指定」を強調
- `update_todo`: ステータスの5段階フローを説明に追加
- `list_todos`: ステータスの選択肢を最新に

## 変更ファイル

- `taskflow-cmux-server.ts` — buildSystemPrompt() 書き換え
- `agent-tools.ts` — ツール説明改善
- `frontend/components/chat/ChatPanel.tsx` — ViewContext構築 + ページ切替時auto-greet

## 変更しないファイル

- バックエンド API
- bridge.ts（既にcontext対応済み）
- DB

## 検証

1. カンバンページでチャットパネルを開く → 自動的に提案メッセージが表示される
2. タスク詳細ページに遷移 → 新しい提案メッセージが表示される
3. エージェントにタスク作成を依頼 → 操作後にtodo_logが記録される
4. ステータス変更を依頼 → 5段階フローに従って変更される
