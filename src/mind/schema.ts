export const MIND_DDL = `CREATE TABLE IF NOT EXISTS identity (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  persona TEXT NOT NULL,
  core TEXT NOT NULL,
  temperament_json TEXT NOT NULL,
  paused INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'selected', 'dismissed')),
  created_at INTEGER NOT NULL,
  lineage_id TEXT
);

CREATE TABLE IF NOT EXISTS utterances (
  id TEXT PRIMARY KEY,
  lineage_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS lineages (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('core', 'suggestion')),
  suggestion_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('relating', 'connected', 'exploring', 'unrelated', 'concluded', 'parked')),
  stashed_from_lineage_id TEXT,
  dig_sessions INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  brief_type TEXT NOT NULL,
  lineage_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  outcome TEXT,
  thought_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  lineage_id TEXT NOT NULL,
  suggestion_id TEXT,
  parent_id TEXT,
  body TEXT NOT NULL,
  distance_to_core REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agenda_items (
  id TEXT PRIMARY KEY,
  lineage_id TEXT NOT NULL,
  origin_session_id TEXT NOT NULL,
  origin_thought_id TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'done'))
);`;

export const MIND_FLAGS_DDL = `CREATE TABLE IF NOT EXISTS flags (
  force_pending INTEGER NOT NULL DEFAULT 0,
  talk_pending INTEGER NOT NULL DEFAULT 0,
  abort_generation INTEGER NOT NULL DEFAULT 0
);`;
