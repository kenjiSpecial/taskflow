---
title: "feat: /taskflow addにプロジェクト必須紐付け+ワークスペース確認を追加"
type: feat
status: completed
date: 2026-03-03
brainstorm: docs/brainstorms/2026-03-03-taskflow-add-improvement-brainstorm.md
---

# feat: /taskflow addにプロジェクト必須紐付け+ワークスペース確認を追加

## Overview

`/taskflow add` でタスク追加後、ポストプロセスとして (1) プロジェクトへの必須紐付け、(2) cmuxワークスペース作成確認を行うようSKILL.mdを改修する。`project_id` がnullのまま残るタスクを防止する。

## Problem Statement / Motivation

現状の `/taskflow add` ではプロジェクト選択がオプショナルで、スキップすると `project_id=null` のタスクが作成される。結果として未分類タスクが蓄積し、プロジェクト別の管理が破綻する。また、タスク追加後にセッション+ワークスペースを手動で別途作成する手間がある。

## Proposed Solution

**ポストプロセス方式**: タスク作成（POST）は即座に完了させ、作成後にプロジェクト紐付け（PATCH）とワークスペース確認を行う。

### 変更対象

**SKILL.mdのみ**（`~/.agents/skills/taskflow/SKILL.md`）。API・フロントエンドの変更なし。

### 新しいフロー

```
[既存] タスク作成（POST /api/todos）← project関連フィールドなしで即POST
   ↓
[新規] ステップA: プロジェクト紐付け
   - GET /api/projects で一覧取得
   - LLMがタスクタイトルとプロジェクト名を照合して推測
   - 推測あり → 「プロジェクト『X』に紐付けますか？」確認
   - 推測なし or 拒否 → プロジェクト一覧から選択
   - 該当なし → 新規プロジェクト作成（POST /api/projects）
   - PATCH /api/todos/:id で { project_id, project } を設定
   ↓
[新規] ステップB: ワークスペース作成確認
   - 「このタスクでワークスペースを作成しますか？」
   - Yes → セッション作成 + タスクリンク + cmux起動
   - No → 完了
```

## Technical Considerations

### 1. 既存ステップ4（プロジェクト選択）の削除

現行インタラクティブモードのステップ4を**削除**し、ポストプロセス（ステップA）に一本化する。理由：二重にプロジェクトを聞くUXは混乱を招く。

**変更前** (SKILL.md Line 207-214):
```
1. タイトル → 2. 優先度 → 3. 期日 → 4. プロジェクト → 5. 親タスク → 6. サブタスク
```

**変更後**:
```
1. タイトル → 2. 優先度 → 3. 期日 → 4. 親タスク → 5. サブタスク → POST → ステップA → ステップB
```

### 2. プロジェクト推測ロジック

SKILL.mdはLLM（Claude）への指示書であるため、マッチングアルゴリズムをコードで実装する必要はない。以下の指示を記載する：

> プロジェクト一覧を参照し、タスクタイトルから最も適切なプロジェクトを推測せよ。推測に自信がない場合は一覧を提示して選択させよ。

- **マッチ候補が複数**: 全候補を提示してユーザーに選択させる
- **アーカイブ済みプロジェクト**: 除外（デフォルトのGET挙動）

### 3. レガシー `project` フィールドの同期

PATCHで `project_id` を設定する際、レガシー `project` フィールドもプロジェクト名で同時更新する：

```json
{ "project_id": "<uuid>", "project": "<project-name>" }
```

### 4. サブタスクのプロジェクト継承

サブタスクは親タスクの `project_id` を自動継承する。ポストプロセスのプロジェクト確認は親タスクのみ実行。サブタスク作成時（ステップ5のループ内）のPOSTに親と同じ `project_id` と `project` を含める。

### 5. ワンショットモードの扱い

`/taskflow add タイトル --project X` の場合：
1. `--project X` はPOST時に `project` フィールドとして送信（従来通り）
2. ポストプロセスで `GET /api/projects` を取得し、名前 `X` でマッチするプロジェクトを検索
3. マッチあり → 「プロジェクト『X』でよいですか？」確認 → PATCH で `project_id` も設定
4. マッチなし → 「プロジェクト『X』が見つかりません。新規作成しますか？」

### 6. ワークスペース作成（ステップB）の詳細

既存の `session start` フロー（SKILL.md Line 313-361）を踏襲：
- セッション `title`: タスクのタイトルをそのまま使用
- セッション `project_id`: ステップAで紐付けたプロジェクトと同じ
- セッション `project`: プロジェクト名
- active同時1件制約: 既存activeセッションがあれば一時停止を提案
- cmux連携: `taskflow-cmux start <session-id>` を実行（失敗してもエラーにしない）

### 7. エラーハンドリング

- **PATCH失敗**（ステップA）: エラーメッセージを表示し、手動でプロジェクト紐付けを促す。タスク自体は作成済みのため再作成は不要
- **セッション作成失敗**（ステップB）: エラーメッセージを表示。タスクとプロジェクト紐付けは完了済み
- **cmux起動失敗**: スキップ（既存方針通り）

### 8. プロジェクト0件の場合

初回利用時など `GET /api/projects` が空配列を返す場合：
- マッチング不要で直接「新規プロジェクト作成」に遷移
- `name` のみ必須、`directory_path` は任意で入力を促す

## Acceptance Criteria

- [x] SKILL.md のインタラクティブモード `/taskflow add` からステップ4（プロジェクト選択）を削除
- [x] SKILL.md にステップA（プロジェクト必須紐付けポストプロセス）を追加
- [x] SKILL.md にステップB（ワークスペース作成確認ポストプロセス）を追加
- [x] ワンショットモードでも `--project` 指定の確認フローを記載
- [x] サブタスクのプロジェクト自動継承ルールを記載
- [x] レガシー `project` フィールドの同期ルールを記載
- [x] プロジェクト0件時のフローを記載
- [x] エラーハンドリング方針を記載
- [x] POST /api/todos ボディ仕様に `project_id` フィールドを追記

## Implementation Tasks

### Task 1: SKILL.md のAPIボディ仕様を修正

`~/.agents/skills/taskflow/SKILL.md` Line 123-136

POST /api/todos ボディに `project_id` フィールドを追記する。

### Task 2: インタラクティブモードのフロー修正

`~/.agents/skills/taskflow/SKILL.md` Line 193-216

- ステップ4（プロジェクト選択）を削除
- ステップの番号振り直し（5→4, 6→5）
- POST時に `project` 関連フィールドを含めない旨を明記

### Task 3: ポストプロセス・ステップAを追記

Line 216の後に新しいセクションを追加:

「タスク追加後のポストプロセス」セクションとして、プロジェクト推測→確認→PATCHの流れを記載。

### Task 4: ポストプロセス・ステップBを追記

ステップAの後にワークスペース作成確認フローを記載。既存の `session start` フロー（Line 313-361）を参照しつつ簡潔に。

### Task 5: ワンショットモードの修正

`~/.agents/skills/taskflow/SKILL.md` Line 195-201

`--project` 指定時のポストプロセス確認フローを追記。

### Task 6: サブタスク・エラーハンドリング・補足事項

- サブタスクのプロジェクト自動継承ルール
- PATCH失敗時のフォールバック
- プロジェクト0件時のフロー

## Dependencies & Risks

- **依存なし**: SKILL.mdのみの変更でAPI・フロントエンドに影響なし
- **リスク**: ポストプロセスの2ステップ追加によりタスク追加のインタラクション量が増える。ただしプロジェクト推測が的中すれば確認1回で済むため、現行の手動選択より簡潔になる可能性もある

## References & Research

### Internal References

- ブレスト: `docs/brainstorms/2026-03-03-taskflow-add-improvement-brainstorm.md`
- SKILL.md: `~/.agents/skills/taskflow/SKILL.md`
- API ヘルパー: `~/.agents/skills/taskflow/scripts/taskflow-api.sh`
- Todo バリデータ: `src/validators/todo.ts` (project_id: Line 10)
- Todo ルート: `src/routes/todos.ts` (POST: Line 153, PATCH: Line 209)
- Project ルート: `src/routes/projects.ts` (GET: Line 31, POST: Line 79)
- Session ルート: `src/routes/sessions.ts`
- cmux ブリッジ: `taskflow-cmux`

### Related Plans

- `docs/plans/2026-03-01-feat-taskflow-session-subcommands-plan.md` (session start フロー)
- `docs/plans/2026-03-02-feat-taskflow-cmux-bridge-cli-plan.md` (cmux連携)
