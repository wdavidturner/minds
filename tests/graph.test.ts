import { describe, expect, it } from "vitest";
import { buildGraphPayload } from "../src/mind/graph";
import { MIND_DDL } from "../src/mind/schema";

describe("buildGraphPayload", () => {
  it("includes closed unrelated lineages and links agenda to its origin session", () => {
    const payload = buildGraphPayload(
      [
        {
          slug: "sample-mind",
          name: "Sample Mind",
          persona: "A careful observer.",
          core: "Notice patterns in ordinary things.",
          temperament_json: '{"curiosity":0.5}',
          paused: 0,
          created_at: 1_000,
        },
      ],
      [
        {
          id: "lineage-core",
          kind: "core",
          suggestion_id: null,
          status: "exploring",
          stashed_from_lineage_id: null,
          dig_sessions: 0,
          created_at: 1_001,
          closed_at: null,
        },
        {
          id: "lineage-closed",
          kind: "suggestion",
          suggestion_id: "suggestion-1",
          status: "unrelated",
          stashed_from_lineage_id: null,
          dig_sessions: 1,
          created_at: 1_002,
          closed_at: 1_008,
        },
      ],
      [
        {
          id: "session-1",
          brief_type: "continue_line",
          lineage_id: "lineage-core",
          started_at: 1_003,
          ended_at: 1_004,
          outcome: "expand",
          thought_count: 1,
        },
      ],
      [
        {
          id: "thought-1",
          session_id: "session-1",
          lineage_id: "lineage-core",
          suggestion_id: null,
          parent_id: null,
          body: "A generic observation.",
          distance_to_core: 0.25,
          created_at: 1_004,
        },
      ],
      [
        {
          id: "agenda-1",
          lineage_id: "lineage-core",
          origin_session_id: "session-1",
          origin_thought_id: "thought-1",
          text: "Consider a nearby example.",
          status: "pending",
        },
      ],
    );

    expect(payload).toEqual({
      slug: "sample-mind",
      name: "Sample Mind",
      core: "Notice patterns in ordinary things.",
      lineages: [
        {
          id: "lineage-core",
          kind: "core",
          suggestion_id: null,
          status: "exploring",
          stashed_from_lineage_id: null,
          dig_sessions: 0,
          created_at: 1_001,
          closed_at: null,
        },
        {
          id: "lineage-closed",
          kind: "suggestion",
          suggestion_id: "suggestion-1",
          status: "unrelated",
          stashed_from_lineage_id: null,
          dig_sessions: 1,
          created_at: 1_002,
          closed_at: 1_008,
        },
      ],
      sessions: [
        {
          id: "session-1",
          brief_type: "continue_line",
          lineage_id: "lineage-core",
          started_at: 1_003,
          ended_at: 1_004,
          outcome: "expand",
          thought_count: 1,
        },
      ],
      thoughts: [
        {
          id: "thought-1",
          session_id: "session-1",
          lineage_id: "lineage-core",
          suggestion_id: null,
          parent_id: null,
          body: "A generic observation.",
          distance_to_core: 0.25,
          created_at: 1_004,
        },
      ],
      agenda: [
        {
          id: "agenda-1",
          lineage_id: "lineage-core",
          origin_session_id: "session-1",
          origin_thought_id: "thought-1",
          text: "Consider a nearby example.",
          status: "pending",
        },
      ],
    });
  });
});

describe("MIND_DDL", () => {
  it("defines every Mind SQLite table with the specified column types", () => {
    expect(MIND_DDL).toBe(`CREATE TABLE IF NOT EXISTS identity (
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
);`);
  });
});
