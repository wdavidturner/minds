import { describe, expect, it } from "vitest";
import { applyOutcome, nextWakeSeconds } from "../src/mind/apply-outcome";
import { DEFAULTS } from "../src/defaults";

describe("applyOutcome", () => {
  it("unrelated closes and restores stash", () => {
    const r = applyOutcome({
      outcome: "unrelated",
      brief: "relate",
      activeLineageId: "probe",
    });
    expect(r.lineage).toEqual({
      id: "probe",
      status: "unrelated",
      closed: true,
      restoreStash: true,
    });
    expect(r.wakeHot).toBe(false);
  });
  it("connected marks lineage connected", () => {
    const r = applyOutcome({
      outcome: "connected",
      brief: "relate",
      activeLineageId: "probe",
    });
    expect(r.lineage?.status).toBe("connected");
    expect(r.wakeHot).toBe(true);
  });
  it("expand keeps agenda texts and is hot", () => {
    const r = applyOutcome({
      outcome: "expand",
      brief: "continue_line",
      activeLineageId: "core",
      agendaTexts: ["a", "b", "c"],
    });
    expect(r.agendaTexts).toEqual(["a", "b", "c"]);
    expect(r.wakeHot).toBe(true);
  });
  it("dig increments and is hot", () => {
    const r = applyOutcome({
      outcome: "dig",
      brief: "relate",
      activeLineageId: "probe",
    });
    expect(r.lineage?.digSessions).toBe(1);
    expect(r.wakeHot).toBe(true);
  });
  it("noop is idle", () => {
    expect(
      applyOutcome({ outcome: "noop", brief: "grow_frontier", activeLineageId: "core" }).wakeHot,
    ).toBe(false);
  });
  it("select_suggestion does not end the line", () => {
    const r = applyOutcome({
      outcome: "select_suggestion",
      brief: "inbox_glance",
      activeLineageId: null,
    });
    expect(r.nextBriefHint).toBe("relate");
    expect(r.wakeHot).toBe(true);
  });
});

describe("nextWakeSeconds", () => {
  it("hot vs idle", () => {
    expect(nextWakeSeconds({ lineage: null, wakeHot: true }, DEFAULTS)).toBe(45);
    expect(nextWakeSeconds({ lineage: null, wakeHot: false }, DEFAULTS)).toBe(720);
  });
});
