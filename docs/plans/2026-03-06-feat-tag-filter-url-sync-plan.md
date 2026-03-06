---
title: "feat: タグフィルタ状態をURLクエリパラメータに同期"
type: feat
status: completed
date: 2026-03-06
---

# feat: タグフィルタ状態をURLクエリパラメータに同期

## Overview

タグを選択すると `/#/?tag=<tagId>` のようにURLが変わり、リロード時に前回のタグフィルタ状態が復元される。現状はタグ選択がメモリ上のsignalのみで管理されており、リロードでリセットされる。

## 実装方針

`wouter-preact` のハッシュベースルーティング（`useHashLocation`）を使用中。ハッシュ内のクエリパラメータ（`#/?tag=xxx`）で状態を管理する。

### 変更対象ファイル

#### 1. `frontend/src/stores/tag-store.ts`

**現状:** `selectedTagId = signal<string | null>(null)` でタグ選択を管理

**変更:**
- 初期化時にURLハッシュからクエリパラメータ `tag` を読み取り、`selectedTagId` の初期値に設定
- `selectedTagId` を変更する関数 `selectTag(tagId: string | null)` を追加
  - signalの値を更新
  - `window.location.hash` のクエリパラメータを更新（`history.replaceState` でブラウザ履歴を汚さない）

**ヘルパー関数:**
- `getHashParams(): URLSearchParams` — `location.hash` からクエリパラメータを抽出
- `setHashParam(key, value)` — ハッシュ内のクエリパラメータを更新

#### 2. `frontend/src/components/MatrixHeader.tsx`

**現状:** 行116-136でタグチップをクリック時に `selectedTagId.value = tagId` を直接設定

**変更:**
- `selectedTagId.value = ...` を `selectTag(tagId)` に置き換え

### URL形式

```
/#/                → タグなし（デフォルト）
/#/?tag=abc123     → タグ選択済み
/#/projects/xyz    → プロジェクト詳細（影響なし）
```

### 注意事項

- `history.replaceState` を使う（`pushState` だとブラウザバックが煩雑になる）
- ハッシュルーティングなのでクエリパラメータはハッシュ内（`#/?tag=xxx`）に含める
- wouter-preactのルーティングに影響を与えないようにする（パス部分は変更しない）
- タグが存在しないIDの場合は無視して `null` にフォールバック

## Acceptance Criteria

- [x] タグ選択時にURLが `/#/?tag=<tagId>` に変わる
- [x] 「すべて」選択時にURLから `tag` パラメータが消える
- [x] リロード時に前回選択したタグが復元される
- [x] 存在しないタグIDがURLにある場合、フィルタなし状態にフォールバック
- [x] プロジェクト詳細ページ（`/#/projects/:id`）には影響しない
- [x] ブラウザの戻る/進むで余計な履歴が残らない（replaceState使用）

## References

- タグ選択signal: `frontend/src/stores/tag-store.ts:10`
- タグフィルタUI: `frontend/src/components/MatrixHeader.tsx:116-136`
- ルーター設定: `frontend/src/app.tsx:2-3,24-27`
- フィルタリング: `frontend/src/stores/project-store.ts:11-22`
