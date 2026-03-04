---
title: "Matrix View 3カラムグリッド化"
date: 2026-03-04
status: completed
---

# Matrix View 3カラムグリッド化

## What We're Building

Matrix Viewのグリッドモードを5カラム（Project | Active | Paused | Done | Tasks）から **3カラム（Project | Active | Tasks）** に変更する。Paused/DoneはProject列内のバッジとして統合し、クリックで全幅展開行として表示する。

### レイアウト

```
┌─── Project ────┬────── Active ──────┬──── Tasks ───┐
│ Alpha          │ ▶ UI改修セッション │ ☐ task1     │
│ ⏸1 ✓3          │ ▶ API設計          │ ☐ task2     │
│ (説明文...)    │                    │ 3件         │
├────────────────┴────────────────────┴──────────────┤
│ ⏸ セッションA  | ✓ セッションB  | ✓ セッションC │  ← バッジクリックで展開
├────────────────┬────────────────────┬──────────────┤
│ Beta  ⏸2 ✓1   │ (なし)             │ ☐ task1     │
└────────────────┴────────────────────┴──────────────┘
```

## Why This Approach

- **3つの重要情報（Project / Active / Tasks）に焦点を絞る**: Paused/Doneは「今何をやっているか」の把握には直接関係しない
- **カードモードの実績あるバッジパターンを再利用**: 既にカードモードで動作検証済みのPaused/Doneバッジ方式をグリッドに適用
- **5カラムの課題を解消**: Paused/Doneが同じ存在感を占めていた問題を根本的に解決

## Key Decisions

1. **5カラム → 3カラムに置き換え**: 現在のグリッドモードを差し替える（別ビュー追加ではない）
2. **カラム幅比率: `1fr | 1.5fr | 1fr`**: Activeが最も広く、Project/Tasksは同幅
3. **Paused/DoneはProject列内にバッジ表示**: カードモードと同様の `⏸ N` `✓ N` バッジ
4. **バッジクリック → 全幅展開行**: SessionInlineDetailと同じgrid-column: 1/-1パターン
5. **SessionCell不要に**: 3カラム化でPaused/Done個別セルが不要。Active列は専用コンポーネントで表示

## Resolved Questions

- **バッジの展開方法**: 全幅展開行を採用（Project列セル内展開ではなく）
- **既存5カラムグリッドの扱い**: 置き換え。トグルは「カード / グリッド」の2パターンのまま
- **Project列の幅**: 固定pxではなく1fr（可変幅）で広めに確保
