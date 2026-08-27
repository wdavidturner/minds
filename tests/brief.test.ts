import { describe, expect, it } from "vitest";
import { decideBrief, legalOutcomes, mayEndSession } from "../src/mind/brief";
import type { MindSnapshot } from "../src/types";

const empty: MindSnapshot = {
  paused: false,
  forcePending: false,
  talkPending: false,
  agendaPendingCount: 0,
  activeLineage: null,
  hasRelatingOpen: false,
  hasOpenBranch: false,
  queuedCount: 0,
};

describe("decideBrief", () => {
  it("force beats agenda", () => {
    expect(
      decideBrief({ ...empty, forcePending: true, agendaPendingCount: 3, hasOpenBranch: true }),
    ).toBe("relate");
  });

  it("talk beats agenda", () => {
    expect(
      decideBrief({ ...empty, talkPending: true, agendaPendingCount: 3, hasOpenBranch: true }),
    ).toBe("talk");
  });

  it("agenda before dig", () => {
    expect(
      decideBrief({
        ...empty,
        agendaPendingCount: 1,
        activeLineage: { id: "l", status: "relating", kind: "suggestion", digSessions: 1 },
        hasRelatingOpen: true,
        hasOpenBranch: true,
      }),
    ).toBe("pursue_agenda");
  });

  it("dig when relating mid-dig under cap", () => {
    expect(
      decideBrief({
        ...empty,
        activeLineage: { id: "l", status: "relating", kind: "suggestion", digSessions: 1 },
        hasRelatingOpen: true,
        hasOpenBranch: true,
      }),
    ).toBe("dig");
  });

  it("relate when relating has not started digging", () => {
    expect(
      decideBrief({
        ...empty,
        activeLineage: { id: "l", status: "relating", kind: "suggestion", digSessions: 0 },
        hasRelatingOpen: true,
      }),
    ).toBe("relate");
  });

  it("relate when relating and dig cap hit", () => {
    expect(
      decideBrief({
        ...empty,
        activeLineage: { id: "l", status: "relating", kind: "suggestion", digSessions: 4 },
        hasRelatingOpen: true,
        hasOpenBranch: true,
      }),
    ).toBe("relate");
  });

  it("continue_line for open connected branch", () => {
    expect(
      decideBrief({
        ...empty,
        activeLineage: { id: "c", status: "connected", kind: "suggestion", digSessions: 0 },
        hasOpenBranch: true,
      }),
    ).toBe("continue_line");
  });

  it("inbox_glance when queue and no live branch", () => {
    expect(decideBrief({ ...empty, queuedCount: 2 })).toBe("inbox_glance");
  });

  it("grow_frontier when idle", () => {
    expect(decideBrief(empty)).toBe("grow_frontier");
  });

  it("paused does not change the selected brief", () => {
    expect(decideBrief({ ...empty, paused: true, queuedCount: 1 })).toBe("inbox_glance");
  });
});

describe("legalOutcomes", () => {
  it.each([
    [
      "continue_line",
      ["continue_line", "expand", "conclude", "park", "noop"],
    ],
    ["pursue_agenda", ["continue_line", "expand", "conclude", "park"]],
    ["relate", ["connected", "unrelated", "dig"]],
    ["inbox_glance", ["select_suggestion", "ignore_inbox"]],
    ["grow_frontier", ["continue_line", "expand", "noop"]],
  ] as const)("%s menu", (brief, expected) => {
    expect(legalOutcomes(brief)).toEqual(expected);
  });

  it("talk uses underlying brief", () => {
    expect(legalOutcomes("talk", { underlyingBrief: "relate" })).toEqual([
      "connected",
      "unrelated",
      "dig",
    ]);
  });

  it("talk without underlying brief uses continue_line menu", () => {
    expect(legalOutcomes("talk")).toEqual([
      "continue_line",
      "expand",
      "conclude",
      "park",
      "noop",
    ]);
  });

  it("dig on a relating lineage uses relate menu", () => {
    expect(legalOutcomes("dig", { lineageStatus: "relating" })).toEqual([
      "connected",
      "unrelated",
      "dig",
    ]);
  });

  it("dig on another lineage status uses continue_line menu", () => {
    expect(legalOutcomes("dig", { lineageStatus: "exploring" })).toEqual([
      "continue_line",
      "expand",
      "conclude",
      "park",
      "noop",
    ]);
  });

  it("rejects expand on relate", () => {
    expect(legalOutcomes("relate")).not.toContain("expand");
  });
});

describe("mayEndSession", () => {
  it("blocks before min", () => {
    expect(mayEndSession({ thoughtCount: 3, minThoughts: 8, windDown: false })).toBe(false);
  });

  it("allows at min", () => {
    expect(mayEndSession({ thoughtCount: 8, minThoughts: 8, windDown: false })).toBe(true);
  });

  it("allows in wind-down", () => {
    expect(mayEndSession({ thoughtCount: 1, minThoughts: 8, windDown: true })).toBe(true);
  });
});
