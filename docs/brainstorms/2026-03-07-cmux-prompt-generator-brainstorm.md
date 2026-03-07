# cmux ワークスペース起動時のプロンプト生成改善

Date: 2026-03-07

## What We're Building

`taskflow-cmux start` でClaude Codeのワークスペースを起動する際、セッション情報・プロジェクト設定・過去ログをもとにLLMで初期プロンプトを動的生成する仕組み。

### 現状の課題

- `taskflow-cmux` の `cmd_start` 内で固定テンプレートのプロンプトを組み立てている
- セッションの `description` すら含まれていない
- プロジェクトの性質に応じた役割設定ができない
- 前回の作業コンテキストが復帰しない

### ゴール

1. **プロジェクトに応じた振る舞い**: プロファイルMDで役割を定義し、プロンプトに反映
2. **セッション情報の活用**: description、タスク一覧、過去ログをコンテキストとして含める
3. **暴走防止**: 勝手に実行しない、確認を取る等のガードレールを含める
4. **コンテキスト復帰**: 前回セッションの最新ログから「次にやること」を提示

## Why This Approach

### アプローチ: プロンプトジェネレーター（bun スクリプト）

`~/.taskflow-cmux/prompt-generator.ts` を新設し、`taskflow-cmux start` から呼び出す。

**フロー:**
1. `taskflow-cmux start` がセッション情報をAPIから取得（現状通り）
2. `bun run prompt-generator.ts --session-id <id>` を呼び出し
3. スクリプトが以下を収集:
   - `~/.taskflow-cmux/profiles/{project_name}.md` （あれば）
   - セッションのdescription
   - リンク済みタスク一覧（description含む）
   - 過去セッションの最新ログ3件
4. OpenRouter経由でGemini 3 Flash Previewに投げてプロンプト生成（1-3秒）
5. 生成テキストをstdoutで返す → `taskflow-cmux` がClaude Codeに渡す

**選定理由:**
- LLMで常に生成するため、プロファイルの有無に関わらず柔軟なプロンプトが作れる
- bun スクリプトなので `taskflow-cmux` (bash) から簡単に呼べる
- Gemini 3 Flash は高速・低コストで、プロンプト生成程度なら十分な品質

**不採用案:**
- テンプレート結合のみ → 「いい感じ」にならない
- Taskflow API側 → サーバー改修が大きい、Workers AIの制約

## Key Decisions

1. **実行環境**: bun スクリプト（`prompt-generator.ts`）
2. **LLMモデル**: OpenRouter経由 `google/gemini-3-flash-preview`
3. **プロファイル配置**: `~/.taskflow-cmux/profiles/{project_name}.md`
4. **プロファイルなし時**: セッション情報のみでLLM生成（汎用的な役割になる）
5. **APIキー管理**: `OPENROUTER_API_KEY` 環境変数 or `~/.taskflow-cmux/config.json`

## Design Details

### 入力ソース（優先順）

```
1. プロファイルMD: ~/.taskflow-cmux/profiles/{project_name}.md
   - プロジェクトの役割定義、期待される振る舞い、参照フォルダ等
   - 例: obsidian.md → 「Obsidian編集アシスタント」として振る舞う定義

2. セッション情報（API）
   - session.title
   - session.description
   - session.project / project_id

3. リンク済みタスク（API）
   - 各タスクの title, description, status, priority

4. 過去ログ（API）
   - 同セッションの最新ログ3件（コンテキスト復帰用）
   - 同タスクの過去セッションログ（あれば）

5. プロジェクト情報（API）
   - project.description
   - project.directory_path
```

### プロファイルMDの例

```markdown
# Obsidian プロファイル

## 役割
Obsidian編集アシスタント。ユーザーの意図を読み取り、Obsidian記法を壊さずに編集する。

## 振る舞い
- YAML frontmatter を壊さない
- [[Wikiリンク]] と #tag を維持
- 削除は提案のみ、勝手に実行しない

## 参照フォルダ
- pages/: テーマ別ノート
- journals/: 日付ノート
```

### prompt-generator.ts の責務

1. コマンドライン引数でsession-idを受け取る
2. Taskflow APIからセッション・タスク・ログ・プロジェクト情報を取得
3. プロファイルMDがあれば読み込む
4. メタプロンプト（「以下の情報をもとにClaude Codeへの初期プロンプトを生成してください」）+ 収集情報をLLMに投げる
5. 生成されたプロンプトをstdoutに出力

### taskflow-cmux 側の変更

`cmd_start` の374-395行目（claude_prompt組み立て部分）を以下に置き換え:

```bash
# プロンプト生成
local claude_prompt
claude_prompt=$(bun run "${SCRIPT_DIR}/prompt-generator.ts" --session-id "$session_id" 2>/dev/null) || {
  log_warn "プロンプト生成に失敗。フォールバックテンプレートを使用します"
  claude_prompt="セッション「${session_title}」を開始しました。指示を待ってください。"
}
```

### ガードレール（プロンプトに必ず含める指示）

- 「指示があるまで実行や変更は行わないでください」
- 「不明な点があれば、必ず質問してください」
- 「ファイルの削除は提案のみ」

## Open Questions

（なし — すべて解決済み）

## Resolved Questions

1. **タイミング** → `taskflow-cmux start` 時
2. **実行環境** → bun スクリプト
3. **モデル** → OpenRouter経由 Gemini 3 Flash Preview
4. **プロファイル配置** → `~/.taskflow-cmux/profiles/`
5. **プロファイルなし時** → セッション情報のみでLLM生成
