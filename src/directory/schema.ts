import { DEFAULT_TEMPERAMENT } from "../defaults";

export const DIRECTORY_STATUSES = ["booting", "live", "archived"] as const;

export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

export const DEFAULT_TEMPERAMENT_JSON = JSON.stringify(DEFAULT_TEMPERAMENT);

export const DIRECTORY_DDL = `CREATE TABLE IF NOT EXISTS minds (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  core_summary TEXT NOT NULL,
  temperament_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);`;
