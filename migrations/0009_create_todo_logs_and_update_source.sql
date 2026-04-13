-- todo_logsテーブル新設
CREATE TABLE IF NOT EXISTS todo_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK(length(content) <= 10000),
    source TEXT NOT NULL DEFAULT 'human' CHECK(source IN ('human', 'ai')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_todo_logs_todo_id ON todo_logs(todo_id);

-- session_logsのsource制約をhuman/aiに変更（テーブル再作成）
PRAGMA foreign_keys = OFF;
CREATE TABLE session_logs_new (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT NOT NULL REFERENCES work_sessions(id),
    content TEXT NOT NULL CHECK(length(content) <= 10000),
    source TEXT NOT NULL DEFAULT 'human' CHECK(source IN ('human', 'ai')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
INSERT INTO session_logs_new (id, session_id, content, source, created_at)
SELECT id, session_id, content, 'human', created_at FROM session_logs;
DROP TABLE session_logs;
ALTER TABLE session_logs_new RENAME TO session_logs;
CREATE INDEX idx_session_logs_session_id ON session_logs(session_id);
CREATE INDEX idx_session_logs_created_at ON session_logs(created_at);
PRAGMA foreign_keys = ON;
