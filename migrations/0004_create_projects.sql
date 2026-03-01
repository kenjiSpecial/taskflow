-- 1. projectsテーブル新設
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL CHECK(length(name) <= 100),
    description TEXT CHECK(length(description) <= 2000),
    color TEXT CHECK(length(color) <= 7),
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);

-- 2. 既存project文字列からprojectsレコードを生成
INSERT OR IGNORE INTO projects (id, name)
SELECT lower(hex(randomblob(16))), project
FROM (
    SELECT DISTINCT project FROM todos WHERE project IS NOT NULL AND deleted_at IS NULL
    UNION
    SELECT DISTINCT project FROM work_sessions WHERE project IS NOT NULL AND deleted_at IS NULL
);

-- 3. todosにproject_idカラム追加＆既存データ紐付け
ALTER TABLE todos ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
UPDATE todos SET project_id = (SELECT id FROM projects WHERE name = todos.project) WHERE project IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id) WHERE deleted_at IS NULL;

-- 4. work_sessionsにproject_idカラム追加＆既存データ紐付け
ALTER TABLE work_sessions ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
UPDATE work_sessions SET project_id = (SELECT id FROM projects WHERE name = work_sessions.project) WHERE project IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON work_sessions(project_id) WHERE deleted_at IS NULL;
