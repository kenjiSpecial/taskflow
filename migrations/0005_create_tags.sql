-- tags テーブル
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL CHECK(length(name) <= 50),
    color TEXT CHECK(length(color) <= 7),
    is_preset INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name) WHERE deleted_at IS NULL;

-- プリセットタグ
INSERT INTO tags (name, color, is_preset) VALUES ('仕事', '#3B82F6', 1);
INSERT INTO tags (name, color, is_preset) VALUES ('プライベート', '#10B981', 1);
INSERT INTO tags (name, color, is_preset) VALUES ('学習', '#F59E0B', 1);
INSERT INTO tags (name, color, is_preset) VALUES ('副業', '#8B5CF6', 1);

-- project_tags 中間テーブル
CREATE TABLE IF NOT EXISTS project_tags (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id),
    tag_id TEXT NOT NULL REFERENCES tags(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(project_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_project_tags_project ON project_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tags_tag ON project_tags(tag_id);

-- todo_tags 中間テーブル
CREATE TABLE IF NOT EXISTS todo_tags (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    todo_id TEXT NOT NULL REFERENCES todos(id),
    tag_id TEXT NOT NULL REFERENCES tags(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(todo_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_todo_tags_todo ON todo_tags(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag ON todo_tags(tag_id);
