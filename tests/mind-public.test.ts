import { describe, expect, it } from "vitest";
import { mindPublic } from "../src/html/mind-public";
import type { GraphPayload } from "../src/mind/graph";

const graph: GraphPayload = {
  slug: "ada",
  name: "Ada",
  core: "A thoughtful core.",
  lineages: [
    {
      id: "core-1",
      kind: "core",
      suggestion_id: null,
      status: "exploring",
      stashed_from_lineage_id: null,
      dig_sessions: 0,
      created_at: 1,
      closed_at: null,
    },
    {
      id: "probe-1",
      kind: "suggestion",
      suggestion_id: "sugg-1",
      status: "unrelated",
      stashed_from_lineage_id: "core-1",
      dig_sessions: 1,
      created_at: 2,
      closed_at: 10,
    },
    {
      id: "probe-2",
      kind: "suggestion",
      suggestion_id: "sugg-2",
      status: "parked",
      stashed_from_lineage_id: "core-1",
      dig_sessions: 2,
      created_at: 3,
      closed_at: 20,
    },
  ],
  sessions: [
    {
      id: "session-1",
      brief_type: "continue_line",
      lineage_id: "core-1",
      started_at: 1,
      ended_at: 2,
      outcome: "expand",
      thought_count: 8,
    },
    {
      id: "session-2",
      brief_type: "relate",
      lineage_id: "probe-1",
      started_at: 3,
      ended_at: 4,
      outcome: null,
      thought_count: 3,
    },
  ],
  thoughts: [],
  agenda: [],
};

describe("mindPublic", () => {
  it("shows every lineage including unrelated and parked dead ends", () => {
    const html = mindPublic(graph);
    expect(html).toContain("unrelated");
    expect(html).toContain("parked");
    expect(html).toContain("(closed)");
  });

  it("shows each session's brief and outcome", () => {
    const html = mindPublic(graph);
    expect(html).toContain("continue_line");
    expect(html).toContain("expand");
    expect(html).toContain("relate");
    expect(html).toContain("(open)");
  });

  it("links published notes when present", () => {
    const html = mindPublic(graph, [{ id: "first-note" }]);
    expect(html).toContain("/minds/ada/notes/first-note");
    expect(html).toContain("first-note");
  });

  it("shows a fallback when there are no notes", () => {
    expect(mindPublic(graph, [])).toContain("No published notes.");
  });
});
