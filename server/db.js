import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Ordered list of schema migrations. Each entry runs exactly once, tracked by
 * SQLite's `PRAGMA user_version`. Never edit an existing migration — append a new one.
 */
const MIGRATIONS = [
  `
  CREATE TABLE invitations (
    id               TEXT PRIMARY KEY,
    slug             TEXT NOT NULL UNIQUE,
    template_id      TEXT NOT NULL,
    data             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
    edit_token_hash  TEXT NOT NULL,
    version          INTEGER NOT NULL DEFAULT 1,
    view_count       INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    published_at     TEXT
  );
  CREATE INDEX invitations_status ON invitations(status, updated_at);

  CREATE TABLE slug_history (
    slug           TEXT PRIMARY KEY,
    invitation_id  TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    created_at     TEXT NOT NULL
  );

  CREATE TABLE rsvps (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    invitation_id  TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    name_key       TEXT NOT NULL,
    contact        TEXT NOT NULL DEFAULT '',
    attending      TEXT NOT NULL CHECK (attending IN ('yes', 'no', 'maybe')),
    guests         INTEGER NOT NULL DEFAULT 1,
    side           TEXT NOT NULL DEFAULT '',
    message        TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );
  CREATE UNIQUE INDEX rsvps_identity ON rsvps(invitation_id, name_key, contact);

  CREATE TABLE wishes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    invitation_id  TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    message        TEXT NOT NULL,
    hidden         INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL
  );
  CREATE INDEX wishes_invitation ON wishes(invitation_id, created_at);

  CREATE TABLE assets (
    id             TEXT PRIMARY KEY,
    invitation_id  TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    kind           TEXT NOT NULL CHECK (kind IN ('image', 'audio')),
    file           TEXT NOT NULL,
    thumb          TEXT,
    mime           TEXT NOT NULL,
    width          INTEGER,
    height         INTEGER,
    bytes          INTEGER NOT NULL,
    created_at     TEXT NOT NULL
  );
  CREATE INDEX assets_invitation ON assets(invitation_id);
  `,
];

export function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
