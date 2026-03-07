---
title: "feat: cmux起動時のLLMプロンプト生成"
type: feat
status: active
date: 2026-03-07
brainstorm: docs/brainstorms/2026-03-07-cmux-prompt-generator-brainstorm.md
---

# feat: cmux起動時のLLMプロンプト生成

## Overview

`taskflow-cmux start` でClaude Codeワークスペースを起動する際、セッション情報・プロジェクトプロファイル・過去ログをもとにOpenRouter経由のLLM（Gemini 3 Flash）で初期プロンプトを動的生成する。

**現状**: bash内の固定テンプレート（description未含、役割設定なし、コンテキスト復帰なし）
**目標**: プロジェクトの性質に応じた役割設定、セッション情報の活用、前回作業のコンテキスト復帰

## Technical Approach

### Architecture

```
taskflow-cmux (bash)
  │
  ├── API情報取得（既存ロジック、変更なし）
  │
  ├── bun run prompt-generator.ts --session-id <id>
  │     │
  │     ├── ~/.taskflow-cmux/profiles/{project}.md 読み込み（任意）
  │     ├── Taskflow API からセッション・タスク・ログ・プロジェクト取得
  │     ├── メタプロンプト + 収集情報 → OpenRouter API
  │     └── stdout: 生成プロンプト / exit code: 0
  │
  ├── (失敗時) フォールバックテンプレート
  │
  └── claude --dangerously-skip-permissions '<prompt>'
```

### bash-bun インターフェース契約

| 項目 | 仕様 |
|------|------|
| 正常時 | stdout: 生成プロンプト, exit 0 |
| 失敗時 | stderr: エラーメッセージ, exit 1 |
| タイムアウト | 15秒（bash側で `timeout 15` を付与） |

### ガードレール保証

LLM生成プロンプトに**依存しない**。prompt-generator.ts が以下を**静的に末尾追加**:

```
---
上記の情報を確認し、指示を待ってください。
指示があるまで実行や変更は行わないでください。
不明な点があれば、必ず質問してください。
ファイルの削除は提案のみ行い、実行しないでください。
```

LLMにはガードレール部分を生成させない。LLM生成範囲はコンテキスト情報と役割設定のみ。

## Implementation Phases

### Phase 1: prompt-generator.ts 新規作成

**ファイル**: `~/.taskflow-cmux/prompt-generator.ts`（symlinkで `taskflow/prompt-generator.ts` から管理）

実際のソースは `taskflow` リポジトリ内に置き、`~/.taskflow-cmux/` にはsymlinkを張る（`taskflow-cmux` 本体と同じパターン）。

#### 1.1 基本構造

```
prompt-generator.ts
├── main()
│   ├── parseArgs()          # --session-id 取得
│   ├── loadConfig()         # API URL, トークン, OpenRouterキー
│   ├── fetchSessionData()   # セッション・タスク・ログ・プロジェクト
│   ├── loadProfile()        # ~/.taskflow-cmux/profiles/{project}.md
│   ├── buildContext()       # 収集データをテキスト化
│   ├── generatePrompt()     # OpenRouter API呼び出し
│   ├── appendGuardrails()   # 静的ガードレール追加
│   └── process.stdout.write(result)
```

#### 1.2 API情報取得

```typescript
// fetchSessionData() の取得内容
interface SessionContext {
  session: { title, description, status, project, project_id }
  tasks: Array<{ title, description, status, priority }>  // 上限10件、優先度順
  logs: Array<{ content, created_at }>                     // 最新3件、各500文字まで
  project: { name, description, directory_path }
}
```

**データ量制限**:
- タスク: 優先度high→medium→low順で上位10件
- ログ: 最新3件、各content 500文字でtruncate
- プロファイルMD: 5000文字でtruncate
- 合計入力トークン: ~2000-3000トークンに収める

#### 1.3 OpenRouter API呼び出し

```typescript
// generatePrompt()
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${openrouterApiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: META_PROMPT },
      { role: "user", content: contextText },
    ],
    max_tokens: 1000,
    temperature: 0.3,
  }),
});
```

**タイムアウト**: `AbortController` で10秒（bash側15秒の内側）

#### 1.4 メタプロンプト

prompt-generator.ts 内にハードコード（`META_PROMPT` 定数）:

```
あなたはClaude Codeワークスペースの初期プロンプトを生成するアシスタントです。
以下の情報をもとに、Claude Codeが効果的に作業を開始できる簡潔なプロンプトを日本語で生成してください。

要件:
- セッションの目的・背景を1-2文で説明
- プロジェクトの役割（プロファイルがある場合はそれに従う）を簡潔に記述
- リンク済みタスクを優先度順にリスト
- 前回の作業ログがあれば「前回の続き」として要約
- 全体で300-500文字程度に収める
- ガードレール文言は含めない（別途追加される）
```

#### 1.5 設定管理

`~/.taskflow-cmux/config.json` に追加:

```json
{
  "project_dirs": { ... },
  "openrouter_api_key": "sk-or-...",
  "prompt_generator": {
    "model": "google/gemini-3-flash-preview",
    "timeout_ms": 10000,
    "max_tokens": 1000
  }
}
```

**優先順位**: 環境変数 `OPENROUTER_API_KEY` > config.json `openrouter_api_key`

### Phase 2: taskflow-cmux 側の変更

`taskflow-cmux` の `cmd_start` 関数（374-408行目）を変更。

#### 2.1 プロンプト生成呼び出し

既存の claude_prompt 組み立て部分（374-395行目）を置き換え:

```bash
# プロンプト生成
local script_dir
script_dir="$(cd "$(dirname "$(realpath "$0")")" && pwd)"
local prompt_script="${script_dir}/prompt-generator.ts"

local claude_prompt
if [[ -f "$prompt_script" ]] && command -v bun >/dev/null 2>&1; then
  log_info "プロンプトを生成中..."
  claude_prompt=$(timeout 15 bun run "$prompt_script" --session-id "$session_id" 2>/dev/null) || {
    log_warn "プロンプト生成に失敗。フォールバックテンプレートを使用します"
    claude_prompt=""
  }
fi

# フォールバック
if [[ -z "$claude_prompt" ]]; then
  claude_prompt="セッション「${session_title}」を開始しました。"
  if [[ -n "$project_name" ]]; then
    claude_prompt="${claude_prompt}\nプロジェクト: ${project_name}"
  fi
  # タスク一覧（既存ロジックと同等）
  local task_count
  task_count=$(echo "$tasks_json" | jq 'length')
  if [[ "$task_count" -gt 0 ]]; then
    claude_prompt="${claude_prompt}\n\n関連タスク:"
    claude_prompt="${claude_prompt}\n$(echo "$tasks_json" | jq -r '.[] | "  - " + .title')"
  fi
  claude_prompt="${claude_prompt}\n\n上記の情報を確認し、指示を待ってください。"
  claude_prompt="${claude_prompt}\n指示があるまで実行や変更は行わないでください。"
  claude_prompt="${claude_prompt}\n不明な点があれば、必ず質問してください。"
fi
```

#### 2.2 API情報の重複取得回避

現状 `cmd_start` は既にセッション・タスク・プロジェクト情報を取得している。prompt-generator.ts でも同じAPIを叩くため重複する。

**方針**: prompt-generator.ts は独自にAPI取得する（シンプルさ優先）。API呼び出しは軽量なのでレイテンシ影響は小さい。

### Phase 3: プロファイルMDシステム

#### 3.1 ディレクトリ構造

```
~/.taskflow-cmux/
├── config.json
├── mappings.json
├── profiles/           # NEW
│   ├── obsidian.md
│   ├── taskflow.md
│   └── NOT_A_HOTEL_LP自動化.md
└── prompt-generator.ts  # symlink → taskflow/prompt-generator.ts
```

#### 3.2 プロファイルのマッチング

プロジェクト名からプロファイルを検索:
1. 完全一致: `{project_name}.md`
2. 正規化一致: スペース→`_`、大文字→小文字に変換して一致チェック
3. 見つからない場合: プロファイルなしでLLM生成

#### 3.3 プロファイルMDの推奨構造

```markdown
# {プロジェクト名} プロファイル

## 役割
このプロジェクトでClaude Codeに期待する役割の定義。

## 振る舞いルール
- 守るべき制約やルール
- 禁止事項

## 参照フォルダ
- フォルダパスと説明

## 技術スタック
- 使用技術の列挙（任意）
```

## Acceptance Criteria

### Functional Requirements

- [x] `taskflow-cmux start` 実行時にLLMでプロンプトが生成される
- [x] セッションのdescriptionがプロンプトに反映される
- [x] リンク済みタスク（上位10件）がプロンプトに含まれる
- [x] 過去ログ（最新3件）がプロンプトに含まれる
- [x] プロファイルMDが存在する場合、役割設定がプロンプトに反映される
- [x] プロファイルMDがなくても正常に動作する
- [x] ガードレール文言がLLM出力に依存せず静的に追加される
- [x] LLM生成失敗時にフォールバックテンプレートが使用される
- [x] OpenRouter APIキーが未設定の場合、フォールバックが使用される（クラッシュしない）

### Non-Functional Requirements

- [x] プロンプト生成が15秒以内に完了する（タイムアウト）
- [x] エラー時はstderrに出力し、stdoutを汚さない
- [x] config.json への openrouter_api_key 追加が既存設定を壊さない

## Files to Create/Modify

### New Files

| File | Description |
|------|-------------|
| `prompt-generator.ts` | LLMプロンプト生成スクリプト（リポジトリルートに配置） |

### Modified Files

| File | Change |
|------|--------|
| `taskflow-cmux` | cmd_start のプロンプト組み立て部分を置き換え（374-408行目） |

### User Setup (Manual)

| Action | Description |
|--------|-------------|
| `OPENROUTER_API_KEY` 設定 | `~/.zshrc` に `export OPENROUTER_API_KEY=sk-or-...` を追加 |
| profiles/ 作成 | `mkdir -p ~/.taskflow-cmux/profiles/` |
| プロファイルMD作成 | 必要なプロジェクト分のMDを作成（任意） |

## References

- Brainstorm: `docs/brainstorms/2026-03-07-cmux-prompt-generator-brainstorm.md`
- 既存プロンプト組み立て: `taskflow-cmux:374-408`
- config.json管理パターン: `taskflow-cmux:87-115`
- OpenRouter API docs: https://openrouter.ai/docs
