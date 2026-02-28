---
title: "タスクの親子関連付けUI"
date: 2026-03-01
status: active
---

# タスクの親子関連付けUI

## What We're Building

既存のバックエンド親子タスク機能（`parent_id`、2階層制限）に対して、フル機能のフロントエンドUIを構築する。

**スコープ:**
1. UIからサブタスク作成
2. トグル式ツリー表示（折りたたみ/展開）
3. 親タスクの子タスク進捗カウント（「2/5完了」）
4. 全子タスク完了時の親完了確認
5. HTML Native D&Dによるタスク移動（並び替え＋親変更）
6. PATCH時の階層バリデーション修正（既知バグ）

**ユースケース:**
- 大きなタスクの分解（「API認証実装」→「JWT設計」「ミドルウェア作成」「テスト」）
- チェックリスト的利用（「リリース準備」→「テスト通過」「ドキュメント更新」「デプロイ」）

## Why This Approach

- バックエンドは既に完成（`parent_id`、階層チェック、カスケード削除）
- UIが未対応なのでAPIの機能を活かせていない
- HTML Native D&Dはライブラリ不要で依存を増やさない
- セッション-タスク紐付けで使ったインライン検索パターンの再利用可能

## Key Decisions

| 項目 | 決定 | 理由 |
|------|------|------|
| サブタスク作成UI | TodoItemに「+」ボタン → インライン入力 | 既存フォームとは別の軽量な追加方法 |
| ツリー表示 | トグル式（▶/▼） | タスクが増えたときに一覧が見やすい |
| トグル初期状態 | 展開 | 最初は全部見える方がわかりやすい |
| 進捗表示 | 「2/5完了」テキスト | シンプル、セッション進捗と同パターン |
| 全子完了時 | 確認表示（「親も完了にしますか？」） | 自動完了は勝手すぎ、手動は気づかない |
| D&D方式 | HTML Native Drag and Drop | ライブラリ不要、軽量 |
| D&Dドロップ先 | タスク上 → 子に、タスク間 → 並び替え | ドロップ位置で判定 |
| 親変更の制限 | 2階層チェック（子は親になれない） | CLAUDE.md準拠 |
| PATCH階層チェック | バックエンドに追加 | 既知バグ修正 |
| sort_order | D&D後にPATCHで更新 | 既にカラム存在 |

## Open Questions

（なし - 全質問解決済み）

## References

- 既存親子実装: `src/routes/todos.ts` (POST時の階層チェック)
- フロントエンドツリー: `frontend/src/stores/todo-store.ts` (`parentTodos`, `childrenMap`)
- TodoItem: `frontend/src/components/TodoItem.tsx`
- CLAUDE.md: 「タスク階層は2階層まで（親-子のみ）」
- セッション-タスク紐付けUI: `frontend/src/components/SessionDetail.tsx` (TaskSearch)
