import { describe, expect, it } from "vitest";
import { mindPublic } from "../src/html/mind-public";
import type { GraphPayload } from "../src/mind/graph";

const graph: GraphPayload = {
  slug: "ada",
  name: "Ada",
  core: "A thoughtful core.",
  learned: "",
  learnedAt: null,
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
  thoughts: [
    {
      id: "t-1",
      session_id: "session-1",
      lineage_id: "core-1",
      suggestion_id: null,
      parent_id: null,
      body: "Families keep a shared calendar for a reason.",
      distance_to_core: 0.1,
      created_at: 5,
    },
  ],
  agenda: [
    {
      id: "a-1",
      lineage_id: "core-1",
      origin_session_id: "session-1",
      origin_thought_id: "t-1",
      text: "Who holds the weekly plan?",
      status: "pending",
    },
  ],
  model: "@cf/zai-org/glm-4.7-flash",
  pondering: true,
  paused: false,
};

describe("mindPublic", () => {
  it("shows a live dashboard with exploring, next, stream, and dead ends", () => {
    const html = mindPublic(graph);
    expect(html).toContain("data-mind-dashboard");
    expect(html).toContain("/minds/ada.json");
    expect(html).toContain("/mind-dashboard.js");
    expect(html).toContain("Now exploring");
    expect(html).toContain("Up next");
    expect(html).toContain("Thought stream");
    expect(html).toContain("Who holds the weekly plan?");
    expect(html).toContain("Families keep a shared calendar for a reason.");
    expect(html).toContain("core — exploring");
  });

  it("uses the brain mark in the rail and drops the public-trace note", () => {
    const html = mindPublic(graph);
    expect(html).toContain("🧠");
    expect(html).not.toMatch(/brand-mark">M</);
    expect(html).not.toContain("Public trace");
    expect(html).toContain("rail-foot");
    expect(html).toContain("GLM 4.7 Flash");
  });

  it("makes sidebar stats jump to the matching sections", () => {
    const html = mindPublic(graph);
    expect(html).toContain('href="#noticing"');
    expect(html).toContain('id="noticing"');
    expect(html).toContain('href="#sessions"');
    expect(html).toContain('id="sessions"');
    expect(html).toContain('href="#open-lines"');
    expect(html).toContain('id="open-lines"');
    expect(html).toContain('href="#queue"');
    expect(html).toContain('id="queue"');
    expect(html).toContain("Open lines");
    expect(html).not.toContain("Live lines");
  });

  it("puts the thought stream in a searchable scroll box and splits open lines from the queue", () => {
    const html = mindPublic(graph);
    expect(html).toContain("thought-scroll");
    expect(html).toContain('data-thought-search');
    expect(html).toContain("split-band");
    expect(html).toContain('id="thought-t-1"');
  });

  it("shows a learned summary when one exists", () => {
    const html = mindPublic({
      ...graph,
      learned: "Banking access is the first choke point, not the last.",
      learnedAt: 1_700_000_000_000,
    });
    expect(html).toContain('id="learned"');
    expect(html).toContain("What it has learned");
    expect(html).toContain("Banking access is the first choke point, not the last.");
    expect(html).toContain('href="#learned"');
  });

  it("shows the recovered observation from a truncated tool dump", () => {
    const html = mindPublic({
      ...graph,
      thoughts: [
        {
          ...graph.thoughts[0],
          body: `<tool_call>record_thought<arg_key>body</arg_key><arg_value>What does "capital control" actually look like in cannabis beyond basic banking access`,
        },
      ],
    });
    expect(html).not.toContain("tool_call");
    expect(html).not.toContain("arg_key");
    expect(html).toContain("What does &quot;capital control&quot; actually look like in cannabis beyond basic banking access");
  });

  it("does not show placeholder examining-the-core thoughts", () => {
    const html = mindPublic({
      ...graph,
      thoughts: [
        { ...graph.thoughts[0], body: "Continue examining the core." },
        { ...graph.thoughts[0], id: "t-2", body: "A real observation about payroll." },
      ],
    });
    expect(html).not.toContain("Continue examining the core.");
    expect(html).toContain("A real observation about payroll.");
  });

  it("does not show dumped tool-call markup in the stream", () => {
    const html = mindPublic({
      ...graph,
      thoughts: [
        {
          ...graph.thoughts[0],
          body: `<tool_call>record_thought<arg_key>body</arg_key><arg_value>Concrete mechanism: banks set the pace.</arg_value>`,
        },
      ],
    });
    expect(html).not.toContain("tool_call");
    expect(html).not.toContain("arg_key");
    expect(html).toContain("Concrete mechanism: banks set the pace.");
  });

  it("shows the display name in the rail, not the slug", () => {
    const html = mindPublic(graph);
    expect(html).toContain("<small>Ada</small>");
    expect(html).not.toContain("<small>ada</small>");
  });

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
