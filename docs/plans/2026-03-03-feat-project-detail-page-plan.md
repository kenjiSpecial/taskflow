---
title: "feat: プロジェクト個別ページの作成"
type: feat
status: completed
date: 2026-03-03
brainstorm: docs/brainstorms/2026-03-03-project-detail-page-brainstorm.md
---

# feat: プロジェクト個別ページの作成

## Overview

プロジェクトに紐づくタスクとセッションの状態を、ダッシュボード形式で一目で把握・操作できる個別ページを新設する。ハッシュルーティング（`/#/projects/:id`）でURL直接アクセス可能にし、MatrixViewと並列共存する。

**新規導入する技術:**
- **wouter-preact** — 軽量ルーター（2.2KB gzip、ハッシュルーティング組み込み対応）。preact-routerは非推奨のためwouterを採用。
- **Tailwind CSS v4** — `@tailwindcss/vite`プラグインで設定ファイル不要。`@theme inline`で既存CSS変数と統合。

## Problem Statement / Motivation

現在のMatrixViewはプロジェクト横断の全体俯瞰に適しているが、個別プロジェクトの深掘りには不十分:
- タスクはミニリスト表示で、ステータス別のグループ化や詳細操作がしにくい
- セッション情報がセル内のカード表示に限定されており、ログや紐づきタスクの確認にはインライン展開が必要
- プロジェクトのURL共有やブックマークができない

## Technical Approach

### Architecture

```
/#/                    → MatrixView（既存、変更なし）
/#/projects/:id        → ProjectDetailPage（新規）
/#/projects/:id?view=X → 将来のビュー切り替え用
```

```mermaid
graph TD
    A[App.tsx] --> B[Router - wouter-preact]
    B --> C[/#/ → MatrixView]
    B --> D[/#/projects/:id → ProjectDetailPage]
    D --> E[ProjectHeader]
    D --> F[SummaryCards]
    D --> G[ActiveSessionsSection]
    D --> H[TasksSection]
    D --> I[PausedSessionsSection]
    D --> J[DoneSessionsSection]
```

### データフロー戦略

**既存ストアの全データを保持し、computed でプロジェクトスコープにフィルタする方針。**

理由:
- MatrixViewとの遷移時にデータ再取得が不要
- 既存ストアのCRUD関数がそのまま使える
- 1000件制限は現時点で問題にならない（実データ量が少ない）

```typescript
// ProjectDetailPage 内での利用イメージ
const projectTodos = useComputed(() =>
  todos.value.filter(t => t.project_id === projectId)
);
const projectSessions = useComputed(() =>
  sessions.value.filter(s => s.project_id === projectId)
);
```

### Implementation Phases

#### Phase 1: インフラ整備（ルーティング + Tailwind）

wouter-preact導入とTailwind CSS v4セットアップ。既存MatrixViewが壊れないことを確認。

**タスク:**

- [x]`wouter-preact` をインストール
  - `frontend/package.json`
- [x]`App.tsx` にRouter設定を追加
  - `frontend/src/app.tsx`
  - `<Router hook={useHashLocation}>` でハッシュルーティング
  - `<Switch>` で `/#/` → MatrixView、`/#/projects/:id` → ProjectDetailPage
  - 404ルート追加（NotFoundコンポーネント）
- [x]Tailwind CSS v4をインストール・設定
  - `frontend/package.json` に `tailwindcss`, `@tailwindcss/vite` 追加
  - `frontend/vite.config.ts` に `tailwindcss()` プラグイン追加
  - `frontend/src/styles/global.css` に `@import "tailwindcss"` と `@theme inline` 追加
- [x]既存CSS変数をTailwindカスタムカラーにマッピング
  - `@theme inline` で `--color-app-bg: var(--bg)` 等を定義
- [x]MatrixViewが壊れていないことを確認（手動確認）

**成果物:**
- `frontend/src/app.tsx` — Router設定
- `frontend/vite.config.ts` — Tailwindプラグイン追加
- `frontend/src/styles/global.css` — Tailwindインポート + テーマ統合

<details>
<summary>App.tsx 変更イメージ</summary>

```tsx
// frontend/src/app.tsx
import { useEffect } from "preact/hooks";
import { Router, Route, Switch } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";
import { MatrixView } from "./components/MatrixView";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { NotFound } from "./pages/NotFound";
import { loadProjects } from "./stores/project-store";
import { loadTodos } from "./stores/todo-store";
import { loadSessions } from "./stores/session-store";
import { loadTags } from "./stores/tag-store";

export function App() {
  useEffect(() => {
    loadProjects();
    loadTodos();
    loadSessions();
    loadTags();
  }, []);

  return (
    <Router hook={useHashLocation}>
      <div class="app-container">
        <Switch>
          <Route path="/" component={MatrixView} />
          <Route path="/projects/:id">
            {(params) => <ProjectDetailPage projectId={params.id} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>
    </Router>
  );
}
```

</details>

<details>
<summary>vite.config.ts 変更イメージ</summary>

```ts
// frontend/vite.config.ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
```

</details>

<details>
<summary>global.css Tailwind統合イメージ</summary>

```css
/* frontend/src/styles/global.css */

/* 既存のCSS変数（そのまま維持） */
:root {
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --surface-hover: #242424;
  --border: #2a2a2a;
  --text: #e0e0e0;
  --text-muted: #888;
  --accent: #6366f1;
  --accent-hover: #818cf8;
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --high: #ef4444;
  --medium: #f59e0b;
  --low: #6b7280;
  --radius: 8px;
}

/* Tailwind CSS v4 */
@import "tailwindcss";

@theme inline {
  --color-app-bg: var(--bg);
  --color-app-surface: var(--surface);
  --color-app-surface-hover: var(--surface-hover);
  --color-app-border: var(--border);
  --color-app-text: var(--text);
  --color-app-text-muted: var(--text-muted);
  --color-app-accent: var(--accent);
  --color-app-accent-hover: var(--accent-hover);
  --color-app-danger: var(--danger);
  --color-app-success: var(--success);
  --color-app-warning: var(--warning);
  --radius-app: var(--radius);
}

/* 既存のスタイル（そのまま維持） */
body { ... }
/* ... 残り全て維持 */
```

</details>

#### Phase 2: ProjectDetailPage骨格

ページの基本レイアウト（ヘッダー + サマリーカード + セクション枠）を実装。データ表示のみ、操作は後のPhaseで追加。

**タスク:**

- [x]`ProjectDetailPage` コンポーネントを作成
  - `frontend/src/pages/ProjectDetailPage.tsx`
  - プロジェクトIDからプロジェクト情報をストアから取得
  - 存在しないプロジェクトの場合は「見つかりません」エラー表示 + MatrixViewへのリンク
- [x]`ProjectHeader` コンポーネントを作成
  - `frontend/src/components/project-detail/ProjectHeader.tsx`
  - 戻るボタン（MatrixViewへのリンク `<Link href="/">`）
  - プロジェクト名（色付きボーダー）
  - プロジェクトの説明
  - プロジェクトタグ表示
  - ビュー切り替えアイコンボタン（ダッシュボードのみアクティブ、他はdisabled + tooltip）
- [x]`SummaryCards` コンポーネントを作成
  - `frontend/src/components/project-detail/SummaryCards.tsx`
  - アクティブセッション数、一時停止セッション数、タスク進捗（完了/全体）
  - ストアの computed データから算出
- [x]`ActiveSessionsSection` コンポーネントを作成
  - `frontend/src/components/project-detail/ActiveSessionsSection.tsx`
  - アクティブセッションのカード表示（名前、経過時間、紐づきタスク）
  - 表示のみ（操作は Phase 3）
- [x]`TasksSection` コンポーネントを作成
  - `frontend/src/components/project-detail/TasksSection.tsx`
  - ステータス別グループ表示（進行中 → 未着手 → 完了）
  - 完了グループは初期折りたたみ
  - 親子関係: 親タスクの下にサブタスクをネスト表示
  - 各タスク: チェックボックス、タイトル、優先度バッジ、タグ
  - 表示のみ（操作は Phase 3）
- [x]`PausedSessionsSection` コンポーネントを作成
  - `frontend/src/components/project-detail/PausedSessionsSection.tsx`
  - 一時停止中セッションのカード表示
- [x]`DoneSessionsSection` コンポーネントを作成
  - `frontend/src/components/project-detail/DoneSessionsSection.tsx`
  - 完了セッション（折りたたみ、初期3件表示）
- [x]MatrixViewのプロジェクト名をクリック可能なリンクに変更
  - `frontend/src/components/ProjectCell.tsx`
  - `<Link href={`/projects/${projectId}`}>` に変更
- [x]`NotFound` ページコンポーネントを作成
  - `frontend/src/pages/NotFound.tsx`

**成果物:**
- `frontend/src/pages/ProjectDetailPage.tsx`
- `frontend/src/pages/NotFound.tsx`
- `frontend/src/components/project-detail/ProjectHeader.tsx`
- `frontend/src/components/project-detail/SummaryCards.tsx`
- `frontend/src/components/project-detail/ActiveSessionsSection.tsx`
- `frontend/src/components/project-detail/TasksSection.tsx`
- `frontend/src/components/project-detail/PausedSessionsSection.tsx`
- `frontend/src/components/project-detail/DoneSessionsSection.tsx`

#### Phase 3: フルCRUD操作

各セクションに操作UIを追加。既存ストア関数を活用。

**タスク:**

- [x]タスク操作を追加
  - `TasksSection.tsx` にタスク追加フォーム（タイトル入力のみ、project_id自動設定）
  - チェックボックスで `toggleTodo()` 呼び出し
  - インライン編集（タイトル、優先度、期日）
  - 削除（確認ダイアログ付き）
- [x]セッション操作を追加
  - `ActiveSessionsSection.tsx` に [一時停止] [完了] ボタン
  - `PausedSessionsSection.tsx` に [再開] [完了] ボタン
  - 新規セッション作成ボタン（タイトル入力、project_id自動設定、初期status=active）
  - **activeセッション制約**: 他にactiveセッションがある場合は確認ダイアログ表示（「既存セッションを一時停止して新規開始しますか？」）
- [x]セッション詳細のインライン展開
  - セッションカードクリックでセクション内にインライン展開
  - ログ一覧表示 + ログ追加フォーム
  - 紐づきタスク一覧 + リンク/リンク解除
  - 既存の `SessionInlineDetail` のロジックを参考に、Tailwindで新規実装
- [x]app-store にプロジェクト詳細用のUI状態を追加
  - `frontend/src/stores/app-store.ts`
  - `expandedDetailSessionId` — 詳細ページ内で展開中のセッションID
  - `completedTasksExpanded` — 完了タスクグループの展開状態

**成果物:**
- 上記コンポーネントの更新
- `frontend/src/stores/app-store.ts` 更新

#### Phase 4: 仕上げ

レスポンシブ対応、エラーハンドリング、アクセシビリティの改善。

**タスク:**

- [x]レスポンシブ対応
  - サマリーカード: `md:` 以上で横並び、モバイルで縦並び
  - セクション: フル幅で縦積み
- [x]ローディング状態の実装
  - データ取得中はスケルトンまたはスピナー表示
- [x]エラーハンドリング
  - API失敗時のエラーメッセージ表示
  - 再試行ボタン
- [x]アクセシビリティ
  - 折りたたみセクション: `aria-expanded`
  - ビュー切り替えボタン: `aria-label`, `aria-current`
  - ページ遷移時のフォーカス管理
- [x]動作確認・手動テスト

## Key Design Decisions

### 1. wouter-preact（preact-routerではなく）

preact-routerはアクティブ開発が停止。wouter-preactは:
- 2.2KB gzip と軽量
- `useHashLocation` でハッシュルーティング組み込みサポート
- TypeScript型定義バンドル済み
- Preact公式対応

### 2. ストアデータスコープ: 全データ保持 + computed フィルタ

- 全データを `todos` / `sessions` シグナルに保持し続ける
- プロジェクト詳細ページでは `useComputed` で project_id フィルタ
- MatrixView遷移時にデータ再取得不要
- 既存ストアの全CRUD関数がそのまま使える

### 3. Tailwind v4 `@theme inline`

- 既存CSS変数をランタイムで維持しながらTailwindユーティリティクラスも使える
- 設定ファイル不要（CSS内で完結）
- 既存の素CSSスタイルはそのまま共存

### 4. activeセッション同時1件制約

- UIでも確認ダイアログを表示
- 「既存セッションを一時停止して新規開始しますか？」の選択肢を提供
- CLIと同じ挙動を実現

### 5. コンポーネント配置

新規ページ系は `frontend/src/pages/` に配置し、プロジェクト詳細の子コンポーネントは `frontend/src/components/project-detail/` に配置。既存の `frontend/src/components/` のフラット構造と区別する。

## Acceptance Criteria

### Functional Requirements

- [x]`/#/projects/:id` でプロジェクト個別ページに直接アクセスできる
- [x]MatrixViewのプロジェクト名クリックで個別ページに遷移できる
- [x]戻るボタンでMatrixViewに戻れる
- [x]サマリーカードでアクティブセッション数・一時停止数・タスク進捗が表示される
- [x]タスクがステータス別にグループ化されて表示される
- [x]セッションがステータス別セクションに分かれて表示される
- [x]タスクの作成・編集・ステータス変更・削除ができる
- [x]セッションの作成・開始/一時停止/完了ができる
- [x]セッションカードクリックでログ・紐づきタスクの詳細が展開される
- [x]存在しないプロジェクトIDでアクセスした場合にエラーページが表示される
- [x]ビュー切り替えアイコンボタンが表示される（ダッシュボードのみアクティブ）

### Non-Functional Requirements

- [x]既存のMatrixViewが正常に動作すること（デグレなし）
- [x]Tailwind CSSと既存CSSが競合しないこと
- [x]ルーティング導入でページ読み込み速度に顕著な劣化がないこと

## Dependencies & Prerequisites

- 既存API（`GET /api/projects/:id`, `GET /api/todos?project_id=X`, `GET /api/sessions?project_id=X`）は全て対応済み
- フロントエンドAPIクライアントに `fetchProject(id)` は未定義だが、ストアの `projects` シグナルからIDフィルタで取得可能

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-03-03-project-detail-page-brainstorm.md`
- 既存コンポーネント: `frontend/src/components/SessionInlineDetail.tsx` (インライン展開パターン)
- ストアパターン: `frontend/src/stores/todo-store.ts`, `session-store.ts`
- API定義: `frontend/src/lib/api.ts`
- Signalsルール: `docs/solutions/logic-errors/preact-signals-store-architecture-code-review-findings.md`
- CLAUDE.md規約: `CLAUDE.md` (Preact Signals, ストアAPI)

### External References
- wouter-preact: https://github.com/molefrog/wouter
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4
- `@theme inline`: https://tailwindcss.com/docs/theme
