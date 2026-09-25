PRAGMA foreign_keys = ON;
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE agents (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL, role TEXT NOT NULL, instructions TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), agent_id TEXT NOT NULL REFERENCES agents(id), title TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')), result TEXT, error TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT);
CREATE INDEX tasks_project ON tasks(project_id, created_at);
CREATE UNIQUE INDEX one_running_per_agent ON tasks(agent_id) WHERE status = 'running';
CREATE TABLE auth_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);

CREATE TABLE connectors (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, last_seen TEXT, snapshot TEXT);
