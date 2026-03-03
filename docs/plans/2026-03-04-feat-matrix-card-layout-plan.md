---
title: "feat: マトリックスビューをカード型レイアウトに刷新"
type: feat
status: completed
date: 2026-03-04
brainstorm: docs/brainstorms/2026-03-04-matrix-card-layout-brainstorm.md
---

# feat: マトリックスビューをカード型レイアウトに刷新

## Overview

ファーストビュー（MatrixView）を5カラムグリッドテーブルからカード型縦並びリストに変更する。Project・Active・Tasksの3要素を大きく明確に表示し、Paused/Doneはバッジ化して省スペース化する。

## Problem Statement

- 5カラム均等幅でActive/Tasksの重要情報とPaused/Doneが同じ存在感
- 「今何をやっているか」がすぐに判別しにくい
- Paused/Doneが場所を取りすぎ、画面の大部分を占有

## Proposed Solution

プロジェクトごとの**全幅カード**を縦に並べるレイアウトに変更。Activeセッション有りのプロジェクトは大きなカード、無しのプロジェクトはコンパクトカードで表示する。

### カードレイアウト概要

```
┌──────────────────────────────────────────────────────┐
│ ● Project Alpha  [desc...]      ⏸ 1  ✓ 3    [...]  │
│ ┌───────── Active ──────────┐  ┌──── Tasks ───────┐ │
│ │ ▶ UI改修セッション         │  │ ☐ タスク1        │ │
│ │   最新ログ: CSS修正中...   │  │ ☐ タスク2        │ │
│ │   ████████░░ 6/10         │  │ ☑ タスク3 (done) │ │
│ │                           │  │ + タスク追加      │ │
│ │ ▶ API設計セッション        │  │                  │ │
│ │   ██░░░░░░░░ 1/8          │  │                  │ │
│ │ + セッション追加           │  │                  │ │
│ └───────────────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────┘
  ↓ セッションカードクリック → 下に SessionInlineDetail 展開

┌──────────────────────────────────────────────────────┐
│ ● Project Beta               ⏸ 0  ✓ 2  ▸ Tasks 3件│
└──────────────────────────────────────────────────────┘
  ↑ コンパクトカード（Active無し）。▸ クリックでタスク展開
```

## Technical Approach

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/components/MatrixView.tsx` | グリッドコンテナ → カードリスト、ソートロジック追加 |
| `frontend/src/components/MatrixRow.tsx` | 5セル Fragment → ProjectCard コンポーネント |
| `frontend/src/components/SessionCell.tsx` | 3カラム用 → ActiveSessionArea + StatusBadge に分割 |
| `frontend/src/components/TasksCell.tsx` | カード内セクションに適合（D&D維持） |
| `frontend/src/components/ProjectCell.tsx` | カードヘッダーに統合 |
| `frontend/src/components/SessionInlineDetail.tsx` | `grid-column: 1/-1` → カード直下に配置 |
| `frontend/src/stores/app-store.ts` | `badgeExpandedProjects` signal 追加 |
| `frontend/src/styles/global.css` | `.matrix` グリッド → `.card-list` + `.project-card` スタイル |

### 仕様詳細

#### ラージカード（Active セッション有り）

- **ヘッダー行**: プロジェクト名(リンク) + 説明(1行) + Pausedバッジ + Doneバッジ + メニュー(...)
- **ボディ**: 2カラム（Active左 60% / Tasks右 40%）
  - **Active領域**: 全Activeセッションを表示。各セッションに:
    - タイトル（大きめ）
    - 最新ログプレビュー（`recent_logs[0].content` から80文字。データはAPIの既存フィールド `recent_logs?` を使用）
    - 進捗バー（`task_completed / task_total`）
    - クリック → `expandedSessionId` トグル
  - **Active領域下部**: 「+ セッション追加」ボタン（デフォルト `status: "active"` で作成）
  - **Tasks領域**: 現行 `TasksCell` と同等（親タスク一覧 + D&D + 追加フォーム）
- **セッション詳細**: セッションクリック → カード直下に `SessionInlineDetail` DOM挿入

#### コンパクトカード（Active セッション無し）

- **1行表示**: プロジェクト名 + Pausedバッジ + Doneバッジ + タスク件数トグル + メニュー
- タスク件数クリック → タスクリスト展開（現行 `expandedTaskProjects` シグナルを再利用）
- D&Dドロップターゲットとして機能（タスク移動可能）

#### Paused/Done バッジ

- 件数 > 0 の時のみ表示。0件は非表示
- クリック → カード内インライン展開（アコーディオン）
- 展開内容: 現行 `SessionCell` と同等のセッションカードリスト
- 展開中のセッションカードクリック → `SessionInlineDetail` が同じカード直下に展開
- 新規シグナル: `badgeExpandedProjects = signal<Map<string, Set<"paused" | "done">>>(new Map())`

#### ソートロジック

```
1. Activeセッション有りのプロジェクト（プロジェクト作成順）
2. Activeセッション無しのプロジェクト（プロジェクト作成順）
3. 未分類（常に末尾）
```

`MatrixView.tsx` で `visibleProjects` をソートする `useComputed` を追加。

#### 未分類カード

- 現行と同じく末尾に表示
- Active/コンパクト切替ルールは通常プロジェクトと同じ
- カラーなし、名前は「(未分類)」

### 実装フェーズ

#### Phase 1: カードコンテナ + ヘッダー

1. `MatrixView.tsx`: `.matrix` グリッド → `.card-list` flexbox縦並びコンテナに変更
2. グリッドヘッダー行（Active | Paused | Done | タスク）を削除
3. `MatrixRow.tsx` → `ProjectCard` にリネーム。5セル Fragment → 単一 `<div class="project-card">` ラッパー
4. `ProjectCell.tsx` の内容をカードヘッダーに統合（プロジェクト名 + 説明 + タグ + メニュー）
5. ソートロジック追加

**ファイル変更:**

```
MatrixView.tsx        -- コンテナ変更 + ソート
MatrixRow.tsx         -- ProjectCard化
ProjectCell.tsx       -- カードヘッダー統合
global.css            -- .card-list, .project-card スタイル追加
```

#### Phase 2: ラージ/コンパクト分岐 + Active表示強化

1. Activeセッション有無でカード表示切替
2. ラージカード: Active領域（セッションタイトル大 + ログプレビュー + 進捗バー）+ Tasks領域（2カラム）
3. コンパクトカード: 1行表示 + タスク件数トグル
4. `SessionCell.tsx` を `ActiveSessionArea` に変更

**ファイル変更:**

```
MatrixRow.tsx         -- ラージ/コンパクト分岐
SessionCell.tsx       -- ActiveSessionArea に書き換え
TasksCell.tsx         -- カード内セクション対応
global.css            -- .card-body, .active-session-area, .compact-card スタイル
```

#### Phase 3: Paused/Done バッジ

1. `StatusBadge` コンポーネント新規作成
2. `app-store.ts` に `badgeExpandedProjects` シグナル追加
3. バッジクリック → インライン展開
4. 展開内セッションカードのクリック → `SessionInlineDetail` 展開

**ファイル変更:**

```
新規: StatusBadge.tsx (or BadgeSection within MatrixRow)
app-store.ts          -- badgeExpandedProjects 追加
MatrixRow.tsx         -- バッジ配置
global.css            -- .status-badge, .badge-expanded スタイル
```

#### Phase 4: SessionInlineDetail 配置変更 + D&D

1. `SessionInlineDetail` をカード直下に配置（`grid-column: 1/-1` 削除）
2. タスクD&D: ドロップターゲットをカードのタスク領域に変更
3. コンパクトカードでもドロップ受付可能

**ファイル変更:**

```
SessionInlineDetail.tsx -- 配置変更
MatrixRow.tsx           -- detail 配置場所変更
TasksCell.tsx           -- D&D ドロップターゲット調整
global.css              -- .matrix-detail-row 削除、新配置スタイル
```

#### Phase 5: CSS整理 + 不要スタイル削除

1. 旧 `.matrix` 5カラムグリッド関連CSS削除
2. `.matrix-header-cell` 削除
3. `.matrix-cell` → 新カードセクション用に置換
4. モバイル `@media` ブレークポイント更新
5. 旧スタイルと新スタイルの統合

## Acceptance Criteria

### 機能要件

- [x] ファーストビューがカード型縦並びリストで表示される
- [x] Activeセッション有りのプロジェクトがラージカードで表示される
- [x] Activeセッション無しのプロジェクトがコンパクトカードで表示される
- [x] Activeセッション有りプロジェクトが上にソートされる
- [x] セッションカードクリックで `SessionInlineDetail` が展開される
- [x] Paused/Doneバッジが件数表示され、クリックでインライン展開される
- [x] タスクリストの展開/折りたたみが動作する
- [x] プロジェクト間タスクD&Dが動作する
- [x] タグフィルター、アーカイブトグルが動作する
- [x] プロジェクト追加フォームが動作する
- [x] セッション追加（デフォルトactive）が動作する
- [x] プロジェクト名クリックでProjectDetailPageに遷移する
- [x] プロジェクト編集/タグ管理/アーカイブ/削除メニューが動作する
- [x] 未分類プロジェクトが末尾に表示される

### Signal ルール遵守

- [x] コンポーネント内は `useComputed()` / `useSignal()` のみ使用
- [x] モジュールレベルは `computed()` / `signal()` を使用
- [x] コンポーネントから `api.*` 直接呼び出しなし（ストア経由）

## Dependencies & Risks

- **API変更不要**: `recent_logs` は既に `WorkSession` 型に存在（`api.ts:85`）。バックエンドが返すかの確認のみ
- **D&Dリスク**: ドロップターゲットのCSS変更でD&D動作が壊れる可能性。Phase 4で重点テスト
- **CSS共存**: global.css（BEM）とTailwind が共存。今回はglobal.css側で実装（既存パターンに合わせる）

## References

- ブレスト: `docs/brainstorms/2026-03-04-matrix-card-layout-brainstorm.md`
- 現行MatrixView: `frontend/src/components/MatrixView.tsx`
- カード型参考: `frontend/src/components/project-detail/ActiveSessionsSection.tsx`（Tailwindでの類似パターン）
- Signal学習: `docs/solutions/logic-errors/preact-signals-store-architecture-code-review-findings.md`
