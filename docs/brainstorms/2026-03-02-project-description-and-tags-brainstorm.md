# プロジェクト概要表示 & タグシステム

**日付**: 2026-03-02
**ステータス**: ブレインストーム完了

## 何を作るか

2つの機能を追加する:

### 1. プロジェクトdescription表示・編集

- ProjectCell内のプロジェクト名の下に、descriptionを小さく表示
- プロジェクト編集ダイアログでdescription入力・更新可能に
- **バックエンドは完全実装済み**（DB・API・バリデーション・型すべて対応済み）
- フロントエンドUIの追加のみ

### 2. タグシステム（プロジェクト & タスク両方）

- **プロジェクト**: 属性タグ（仕事/プライベート等）を付与
- **タスク**: 内容タグ（コーディング/調査等）を付与
- ハイブリッド方式: プリセットタグ + カスタムタグ作成可能
- マトリクスビューのヘッダーにタグチップ行でフィルタリング

## なぜこのアプローチか

### アプローチA: シンプル統合（採用）

`tags`テーブル + `project_tags` / `todo_tags` 中間テーブル。

**選定理由**:
- 1つのタグモデルでプロジェクト・タスク両方に対応
- プリセットタグ（シードデータ）+ カスタムタグの柔軟性
- 既存の `showArchived` フィルタパターンを踏襲可能
- カラム追加のみ（B案）より拡張性が高く、フル管理画面（C案）より軽量

**不採用案**:
- B案（カラム追加のみ）: タグ一覧取得が面倒、色やプリセット管理不可
- C案（フル機能）: 個人用に管理画面は過剰

## キー決定事項

1. **description**: フロントエンドUI追加のみ（バックエンド変更なし）
2. **タグDB設計**: `tags` + `project_tags` + `todo_tags` の3テーブル追加
3. **プリセットタグ**: 仕事 / プライベート / 学習 / 副業 の4つ
4. **タグ形式**: ハイブリッド（プリセット + 自由入力）
5. **フィルタUI**: MatrixHeaderにタグチップ行（「全て」+ 各タグ）
6. **description表示**: ProjectCell内、プロジェクト名の直下に小さく

## DB設計案

```sql
-- tags テーブル
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE CHECK(length(name) <= 50),
    color TEXT CHECK(length(color) <= 7),
    is_preset INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    deleted_at TEXT
);

-- プリセットタグ
INSERT INTO tags (name, color, is_preset) VALUES
    ('仕事', '#3B82F6', 1),
    ('プライベート', '#10B981', 1),
    ('学習', '#F59E0B', 1),
    ('副業', '#8B5CF6', 1);

-- project_tags 中間テーブル
CREATE TABLE IF NOT EXISTS project_tags (
    project_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    PRIMARY KEY (project_id, tag_id)
);

-- todo_tags 中間テーブル
CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    PRIMARY KEY (todo_id, tag_id)
);
```

## UI変更イメージ

### MatrixHeader（フィルタ追加）
```
[+ プロジェクト追加]  [全て] [仕事] [プライベート] [学習] [副業]  [□ アーカイブ表示]
```

### ProjectCell（description追加）
```
┌─────────────────┐
│ ■ プロジェクト名  ...│
│   概要テキスト...    │
│   [仕事] [学習]     │
└─────────────────┘
```

## スコープ

### Phase 1: description表示（バックエンド変更なし）
- ProjectCellにdescription表示
- プロジェクト作成/編集ダイアログにdescriptionフィールド追加

### Phase 2: タグシステム
- DBマイグレーション（tags, project_tags, todo_tags）
- タグAPI（CRUD + 紐付け）
- タグストア（Preact signals）
- プロジェクト・タスクへのタグ付けUI
- MatrixHeaderのタグフィルタUI

## オープンな質問

なし（すべて解決済み）
