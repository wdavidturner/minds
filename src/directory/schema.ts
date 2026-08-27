// status is one of: booting | live | archived
// Default temperament JSON: {"branching":0.5,"persistence":0.5,"curiosity":0.5,"distance":0.5}
export const DIRECTORY_DDL = `CREATE TABLE IF NOT EXISTS minds (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  core_summary TEXT NOT NULL,
  temperament_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);`;
