CREATE TABLE IF NOT EXISTS work_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL CHECK(length(title) <= 200),
    description TEXT CHECK(length(description) <= 2000),
    project TEXT CHECK(length(project) <= 100),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'done')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);
CREATE INDEX IF NOT EXISTS idx_work_sessions_project ON work_sessions(project);
CREATE INDEX IF NOT EXISTS idx_work_sessions_deleted_at ON work_sessions(deleted_at);

CREATE TABLE IF NOT EXISTS session_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT NOT NULL REFERENCES work_sessions(id),
    content TEXT NOT NULL CHECK(length(content) <= 10000),
    source TEXT NOT NULL DEFAULT 'ui' CHECK(source IN ('ui', 'cli')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at);
