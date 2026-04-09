# Taskflow エージェントチャット機能

**Date**: 2026-03-08
**Status**: Brainstorm

## What We're Building

Taskflowフロントエンドに右サイドパネル型のチャットUIを追加し、自然言語でタスク操作（Todo, Project, Session, Tag の全CRUD）を行えるエージェント機能。

ローカルのcmuxブリッジサーバー（Bun, port 19876）を拡張し、OpenRouter経由でLLMを呼び出す。LLMにはTaskflow APIをTool（Function Calling）として定義し、タスク操作を自律的に実行させる。応答はSSEでストリーミング。チャット履歴はD1に保存。

## Why This Approach

- **ブリッジサーバー拡張**: 既存インフラ活用。ローカル実行なのでWorkers実行時間制限を回避。APIキーもサーバー側で安全に管理
- **Tool Use パターン**: LLMが宣言的にAPI操作を記述→サーバーが実行。操作の安全性・監査性が高い
- **SSEストリーミング**: ChatGPTライクなUX。既存WebSocket基盤とは別経路（SSEはブリッジサーバーから直接）
- **D1に履歴保存**: 既存DBインフラに統一。デバイス間で履歴共有可能

## Key Decisions

1. **サーバー**: cmuxブリッジサーバー（taskflow-cmux-server.ts）にエージェントエンドポイントを追加
2. **LLM**: OpenRouter経由（既存のprompt-generator.tsと同じパターン）
3. **操作方式**: LLM Tool Use（Function Calling）でTaskflow REST APIを呼び出し
4. **UI**: 右サイドパネル（スライドイン）。既存ビューと並行利用
5. **ストリーミング**: SSE（Server-Sent Events）でトークン逐次送信
6. **履歴**: D1に保存。Workers側にチャット履歴CRUD APIを追加
7. **スコープ**: Todo, Project, Session, Tag の全リソース操作

## Architecture Overview

```
[Frontend Chat UI] --SSE--> [Bridge Server (Bun)]
                                 |
                                 +---> [OpenRouter LLM] (streaming + tool use)
                                 |
                                 +---> [Taskflow Workers API] (tool execution)
                                 |
                                 +---> [Taskflow Workers API] (chat history CRUD)
```

## Resolved Questions

1. **会話のスレッド管理**: 単一会話方式。「新しい会話」ボタンでリセット
2. **Tool実行の確認**: 破壊的操作（削除等）はUIで確認ダイアログを表示してからTool実行
3. **コンテキスト**: 現在のビュー状態（表示中のプロジェクト、フィルター等）をエージェントに渡す
