CREATE TABLE workspaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  todo_id TEXT NOT NULL UNIQUE REFERENCES todos(id) ON DELETE CASCADE,
  zellij_session TEXT CHECK(length(zellij_session) <= 200),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT
);

CREATE UNIQUE INDEX idx_workspaces_todo_id ON workspaces(todo_id) WHERE deleted_at IS NULL;

CREATE TABLE workspace_paths (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  path TEXT NOT NULL CHECK(length(path) <= 500),
  source TEXT NOT NULL CHECK(source IN ('ai', 'human')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_workspace_paths_workspace_id ON workspace_paths(workspace_id);
