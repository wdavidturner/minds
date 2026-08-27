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
  it("clears pending force and talk flags after their respective briefs", () => {
    expect(
      applyOutcome({ outcome: "connected", brief: "relate", activeLineageId: "probe" }).clearForce,
    ).toBe(true);
    expect(
      applyOutcome({ outcome: "continue_line", brief: "talk", activeLineageId: "core" }).clearTalk,
    ).toBe(true);
  });

  it("carries the outcome for session-ending outcomes so it can be persisted", () => {
    expect(applyOutcome({ outcome: "conclude", brief: "continue_line", activeLineageId: "probe" }).outcome).toBe(
      "conclude",
    );
    expect(applyOutcome({ outcome: "continue_line", brief: "continue_line", activeLineageId: null }).outcome).toBe(
      "continue_line",
    );
  });

  it("omits the outcome for select_suggestion/ignore_inbox, which do not end the session", () => {
    expect(
      applyOutcome({ outcome: "select_suggestion", brief: "inbox_glance", activeLineageId: null }).outcome,
    ).toBeUndefined();
    expect(
      applyOutcome({ outcome: "ignore_inbox", brief: "inbox_glance", activeLineageId: null }).outcome,
    ).toBeUndefined();
  });

  it("conclude/park inside pursue_agenda close the agenda item, not the lineage", () => {
    const concluded = applyOutcome({
      outcome: "conclude",
      brief: "pursue_agenda",
      activeLineageId: "core",
    });
    expect(concluded.lineage).toBeNull();
    expect(concluded.agendaItemDone).toBe(true);
    expect(concluded.outcome).toBe("conclude");

    const parked = applyOutcome({
      outcome: "park",
      brief: "pursue_agenda",
      activeLineageId: "core",
    });
    expect(parked.lineage).toBeNull();
    expect(parked.agendaItemDone).toBe(true);
  });

  it("guards the core lineage against conclude/park/unrelated closing it", () => {
    const concluded = applyOutcome({
      outcome: "conclude",
      brief: "continue_line",
      activeLineageId: "core-1",
      activeLineageKind: "core",
    });
    expect(concluded.lineage).toBeNull();

    const parked = applyOutcome({
      outcome: "park",
      brief: "continue_line",
      activeLineageId: "core-1",
      activeLineageKind: "core",
    });
    expect(parked.lineage).toBeNull();

    const unrelated = applyOutcome({
      outcome: "unrelated",
      brief: "relate",
      activeLineageId: "core-1",
      activeLineageKind: "core",
    });
    expect(unrelated.lineage).toBeNull();
  });

  it("still closes a non-core lineage on conclude/park/unrelated", () => {
    expect(
      applyOutcome({
        outcome: "conclude",
        brief: "continue_line",
        activeLineageId: "probe",
        activeLineageKind: "suggestion",
      }).lineage,
    ).toEqual({ id: "probe", status: "concluded", closed: true });
  });
});

describe("nextWakeSeconds", () => {
  it("hot vs idle", () => {
    expect(nextWakeSeconds({ lineage: null, wakeHot: true }, DEFAULTS)).toBe(45);
    expect(nextWakeSeconds({ lineage: null, wakeHot: false }, DEFAULTS)).toBe(720);
  });
});
