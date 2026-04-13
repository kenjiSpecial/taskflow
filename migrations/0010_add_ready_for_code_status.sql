-- ステータスにready_for_codeを追加: backlog | todo | ready_for_code | in_progress | review | done
-- SQLiteではCHECK制約をALTERで変更できないため、テーブル再作成が必要

PRAGMA foreign_keys = OFF;

-- 1. 新テーブルを作成（ready_for_code追加）
CREATE TABLE todos_new (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL CHECK(length(title) <= 200),
    description TEXT CHECK(length(description) <= 2000),
    status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog', 'todo', 'ready_for_code', 'in_progress', 'review', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
    due_date TEXT,
    project TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at TEXT
);

-- 2. データを移行（既存データはそのまま）
INSERT INTO todos_new (id, title, description, status, priority, due_date, project, project_id, parent_id, sort_order, done_at, created_at, updated_at, deleted_at)
SELECT id, title, description, status, priority, due_date, project, project_id, parent_id, sort_order, done_at, created_at, updated_at, deleted_at
FROM todos;

-- 3. 旧テーブルを削除し、新テーブルをリネーム
DROP TABLE todos;
ALTER TABLE todos_new RENAME TO todos;

-- 4. インデックスを再作成
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_priority ON todos(priority);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_project ON todos(project);
CREATE INDEX idx_todos_parent_id ON todos(parent_id);
CREATE INDEX idx_todos_deleted_at ON todos(deleted_at);
CREATE INDEX idx_todos_project_id ON todos(project_id) WHERE deleted_at IS NULL;

PRAGMA foreign_keys = ON;
