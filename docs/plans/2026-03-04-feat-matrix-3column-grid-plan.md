---
title: "feat: Matrix Viewグリッドモードを3カラム化"
type: feat
status: completed
date: 2026-03-04
brainstorm: docs/brainstorms/2026-03-04-matrix-3column-grid-brainstorm.md
---

# feat: Matrix Viewグリッドモードを3カラム化

## Overview

グリッドモードを5カラム（Project | Active | Paused | Done | Tasks）から **3カラム（Project | Active | Tasks）** に変更。Paused/DoneはProject列内バッジに統合し、クリックで全幅展開行として表示。

## Problem Statement

- 5カラムグリッドでPaused/Doneが同じ存在感で表示され、「今何をやっているか」が把握しにくい
- カードモードのバッジ方式は解決済みだが、グリッドモードは旧構造のまま

## Proposed Solution

カードモードで実績あるバッジパターン（`badgeExpandedProjects`シグナル + `toggleBadgeExpanded()`）をグリッドモードに適用。store変更不要。

### レイアウト

```
┌─── Project ────┬────── Active ──────┬──── Tasks ───┐
│ Alpha          │ ▶ UI改修セッション │ ☐ task1     │
│ ⏸1 ✓3          │ ▶ API設計          │ ☐ task2     │
│ (説明文...)    │                    │ 3件         │
├────────────────┴────────────────────┴──────────────┤
│ ⏸ セッションA  | ✓ セッションB  | ✓ セッションC │
├────────────────┬────────────────────┬──────────────┤
│ Beta  ⏸2 ✓1   │ (なし)             │ ☐ task1     │
└────────────────┴────────────────────┴──────────────┘
```

## Technical Approach

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/styles/global.css` | `.matrix` grid-template-columns: `1fr 1.5fr 1fr`、badge展開行スタイル追加 |
| `frontend/src/components/MatrixView.tsx` | ヘッダー5セル → 3セル（Project / Active / Tasks） |
| `frontend/src/components/MatrixRow.tsx` | matrixモード: 5セルFragment → 3セル + バッジ + 展開行 |

### 変更不要ファイル

| ファイル | 理由 |
|---------|------|
| `app-store.ts` | `badgeExpandedProjects` + `toggleBadgeExpanded()` が既存 |
| `SessionCell.tsx` | Active列でそのまま使用（Paused/Done列が消えるだけ） |
| `ProjectCell.tsx` | 内容変更なし（MatrixRowでラップ方法が変わるだけ） |
| `TasksCell.tsx` | 変更なし |

### 仕様詳細

#### CSS変更

```css
/* Before */
.matrix { grid-template-columns: 160px 1fr 1fr 1fr 1fr; }

/* After */
.matrix { grid-template-columns: 1fr 1.5fr 1fr; }
```

- `.matrix-project-cell`にバッジ用のflex/gapスタイル追加
- バッジ展開行: `grid-column: 1 / -1`（既存の`.matrix-detail-row`と同じパターン）

#### MatrixView.tsx ヘッダー変更

```tsx
// Before: 5ヘッダーセル
<div class="matrix-header-cell" />
<div class="matrix-header-cell">Active</div>
<div class="matrix-header-cell">Paused</div>
<div class="matrix-header-cell">Done</div>
<div class="matrix-header-cell">タスク</div>

// After: 3ヘッダーセル
<div class="matrix-header-cell">Project</div>
<div class="matrix-header-cell">Active</div>
<div class="matrix-header-cell">タスク</div>
```

#### MatrixRow.tsx matrixモード変更

```tsx
// Before: 5セル Fragment
<>
  <ProjectCell ... />           // 1
  <SessionCell active ... />    // 2
  <SessionCell paused ... />    // 3 ← 削除
  <SessionCell done ... />      // 4 ← 削除
  <TasksCell ... />             // 5
  {detail && <SessionInlineDetail />}
</>

// After: 3セル + バッジ + 展開行
<>
  <div class="matrix-cell matrix-project-cell">
    <ProjectCell ... />
    <div class="card-badges">    // カードモードから再利用
      {paused > 0 && <button class="card-badge badge-paused" ...>⏸ N</button>}
      {done > 0 && <button class="card-badge badge-done" ...>✓ N</button>}
    </div>
  </div>
  <SessionCell sessions={active} status="active" ... />
  <div class="matrix-cell matrix-tasks-cell">
    <TasksCell ... />
  </div>
  {badgeExpanded && (
    <div class="matrix-detail-row">  // grid-column: 1/-1 全幅
      {pausedExpanded && <BadgeSection sessions={paused} label="一時停止中" />}
      {doneExpanded && <BadgeSection sessions={done} label="完了" />}
    </div>
  )}
  {sessionDetail && <div class="matrix-detail-row"><SessionInlineDetail /></div>}
</>
```

- `BadgeSessionCard`コンポーネント（カードモード既存）を展開行内で再利用
- `badgeExpandedProjects`シグナル + `toggleBadgeExpanded()`をそのまま使用

### 実装フェーズ

#### Phase 1: CSS + ヘッダー変更

1. `global.css`: `.matrix` grid-template-columns を `1fr 1.5fr 1fr` に変更
2. `MatrixView.tsx`: ヘッダーを3セルに変更
3. レスポンシブブレークポイント更新

**ファイル:** `global.css`, `MatrixView.tsx`

#### Phase 2: MatrixRow matrixモード書き換え

1. Paused/Done SessionCell呼び出し削除
2. Project列にバッジ統合
3. バッジ展開行追加（`BadgeSessionCard`再利用）
4. SessionInlineDetailの配置維持

**ファイル:** `MatrixRow.tsx`

## Acceptance Criteria

- [x] グリッドモードが3カラム（Project | Active | Tasks）で表示される
- [x] Project列にPaused/Doneバッジが件数表示される（0件は非表示）
- [x] バッジクリックで全幅展開行にセッション一覧が表示される
- [x] 展開行内セッションクリックでSessionInlineDetailが展開される
- [x] Active列のSessionCellが正常動作する（セッション追加含む）
- [x] Tasks列が正常動作する（D&D、展開、追加）
- [x] カードモードは影響なし（既存動作維持）

### Signal ルール遵守

- [x] コンポーネント内は `useComputed()` / `useSignal()` のみ使用
- [x] コンポーネントから `api.*` 直接呼び出しなし

## Dependencies & Risks

- **store変更不要**: `badgeExpandedProjects`と`toggleBadgeExpanded()`が既存
- **SessionCell.tsx残存**: Active列で引き続き使用。Paused/Done列の呼び出しが消えるだけ
- **CSS共存**: カードモードのバッジスタイル（`.card-badge`等）をグリッドモードでも再利用

## References

- ブレスト: `docs/brainstorms/2026-03-04-matrix-3column-grid-brainstorm.md`
- カードモードバッジ: `frontend/src/components/MatrixRow.tsx:143-198`
- 既存store: `frontend/src/stores/app-store.ts` (`badgeExpandedProjects`)
- Signalルール: `docs/solutions/logic-errors/preact-signals-store-architecture-code-review-findings.md`
