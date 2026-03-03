---
title: "feat: マトリックスビューにカード/グリッド切替トグルを追加"
type: feat
status: completed
date: 2026-03-04
---

# feat: マトリックスビューにカード/グリッド切替トグルを追加

## Overview

MatrixViewに「カード表示」と「グリッド表示」の切替トグルを追加。カードが現在のデフォルトだが、旧5カラムグリッド表示も選択可能にする。

## Problem Statement

カードレイアウトに全面移行したが、情報密度ではグリッド表示の方が一覧性が高いケースがある。ユーザーが好みに応じて切り替えられるようにする。

## Proposed Solution

`ProjectDetailPage`の既存ビュートグルパターンを踏襲。`useSignal` + `localStorage`でモード管理。

## Technical Approach

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/components/MatrixHeader.tsx` | トグルボタン2つ追加（グリッド/カード） |
| `frontend/src/components/MatrixView.tsx` | モード分岐：`card-list` or `matrix`グリッド+ヘッダーセル |
| `frontend/src/components/MatrixRow.tsx` | `viewMode` prop追加。cardモード=現行、matrixモード=旧Fragment(5セル) |
| `frontend/src/components/ProjectCell.tsx` | `viewMode` prop追加。matrixモード時はセルラッパー+color復活 |
| `frontend/src/components/TasksCell.tsx` | `viewMode` prop追加。matrixモード時は旧クラス名 |
| `frontend/src/styles/global.css` | 旧`.matrix`グリッドCSS復元 |

### 仕様詳細

#### ビューモード管理

- 型: `type MatrixViewMode = "card" | "matrix"`
- デフォルト: `"card"`
- localStorage: `"taskflow-matrix-view-mode"` キー
- `MatrixView`コンポーネント内で`useSignal`管理（`ProjectDetailPage`パターン踏襲）
- propsで子コンポーネントに`viewMode`を渡す

#### トグルUI（MatrixHeader内）

- `matrix-toolbar-right`内、アーカイブチェックボックスの左に配置
- アイコンボタン2つ: グリッドアイコン / カードアイコン
- アクティブ状態: `btn-ghost`ベース + 背景ハイライト（global.css、Tailwind不使用）

#### MatrixView分岐

```
viewMode === "card":
  <div class="card-list">
    {sortedProjects → <MatrixRow viewMode="card">}
  </div>

viewMode === "matrix":
  <div class="matrix">
    <div class="matrix-header-cell" />
    <div class="matrix-header-cell">Active</div>
    <div class="matrix-header-cell">Paused</div>
    <div class="matrix-header-cell">Done</div>
    <div class="matrix-header-cell">タスク</div>
    {sortedProjects → <MatrixRow viewMode="matrix">}
  </div>
```

#### MatrixRow分岐

```
viewMode === "card": 現行のproject-cardレンダリング（変更なし）

viewMode === "matrix": 旧Fragment構造
  <>
    <ProjectCell viewMode="matrix" ... /> (matrix-cell matrix-project-cell)
    <SessionCell sessions={active} status="active" ... />
    <SessionCell sessions={paused} status="paused" ... />
    <SessionCell sessions={done} status="done" ... />
    <TasksCell viewMode="matrix" ... /> (matrix-cell matrix-tasks-cell)
    {expanded && <div class="matrix-detail-row"><SessionInlineDetail /></div>}
  </>
```

- `SessionCell.tsx`はファイルが残存しており、matrixモードで再importするだけ

#### CSS復元

削除済みの以下を復元:
- `.matrix` (5カラムグリッド)
- `.matrix-header-cell`
- `.matrix-cell`
- `.matrix-project-cell` / `.matrix-project-cell.archived`
- `.matrix-session-cell`
- `.matrix-tasks-cell`
- `.matrix-detail-row`
- トグルボタン用スタイル `.view-toggle-group`

### 実装フェーズ

#### Phase 1: CSS復元 + トグルUI

1. `global.css`に旧グリッドCSS復元 + トグルボタンスタイル追加
2. `MatrixHeader.tsx`にトグルボタン追加（状態はprops経由）
3. `MatrixView.tsx`に`useSignal` + localStorage + handleViewChange

**ファイル:** `global.css`, `MatrixHeader.tsx`, `MatrixView.tsx`

#### Phase 2: MatrixRow/子コンポーネント分岐

1. `MatrixRow.tsx`に`viewMode` prop追加、matrixモードで旧Fragment構造
2. `ProjectCell.tsx`にmatrixモード用ラッパー(matrix-cell)追加
3. `TasksCell.tsx`にmatrixモード用クラス切替
4. `SessionCell.tsx`をmatrixモードで再import

**ファイル:** `MatrixRow.tsx`, `ProjectCell.tsx`, `TasksCell.tsx`

## Acceptance Criteria

- [x] MatrixHeaderにグリッド/カード切替ボタンが表示される
- [x] カードモード: 現行のカードレイアウトが表示される
- [x] グリッドモード: 旧5カラムグリッドが表示される
- [x] グリッドモード: セッションクリックでSessionInlineDetailが展開される
- [x] グリッドモード: タスク展開/折りたたみが動作する
- [x] グリッドモード: D&Dが動作する
- [x] 選択モードがlocalStorageに永続化される
- [x] ページリロードで選択モードが復元される

### Signal ルール遵守

- [x] `useSignal()` でビューモード管理（コンポーネント内）
- [x] コンポーネントから `api.*` 直接呼び出しなし

## Dependencies & Risks

- **SessionCell.tsx残存**: ファイルは未削除で残っているため、importし直すだけ
- **CSS共存**: 新カードCSS + 旧グリッドCSSが共存。クラス名が異なるため競合なし
- **ソート**: カードモードのソート（Active優先）はグリッドモードでも適用する

## References

- 既存トグルパターン: `frontend/src/components/project-detail/ProjectHeader.tsx:15-103`
- localStorage管理: `frontend/src/pages/ProjectDetailPage.tsx:16-51`
- 旧MatrixView: `git show HEAD~1:frontend/src/components/MatrixView.tsx`
- 旧CSS: `git show HEAD~1:frontend/src/styles/global.css` (L636-L850)
