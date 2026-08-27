import { describe, expect, it } from "vitest";
import {
  runSession,
  type ModelStep,
  type SessionStore,
  type ThoughtRecord,
} from "../src/mind/session-loop";
import type { ApplyResult } from "../src/mind/apply-outcome";
import type { BriefType, MindSnapshot } from "../src/types";

function thought(body: string): ThoughtRecord {
  return { body, distanceToCore: 0, parentId: null };
}

function createStore(opts: { queued?: string[]; snapshot?: Partial<MindSnapshot> } = {}) {
  const state = {
    thoughts: [] as ThoughtRecord[],
    applied: [] as { result: ApplyResult; sessionId: string }[],
    wake: null as number | null,
    activeLineageId: null as string | null,
    queued: opts.queued ? [...opts.queued] : ([] as string[]),
  };

  const store: SessionStore = {
    snapshot(): MindSnapshot {
      return {
        paused: false,
        forcePending: false,
        talkPending: false,
        agendaPendingCount: 0,
        activeLineage: null,
        hasRelatingOpen: false,
        hasOpenBranch: true,
        queuedCount: state.queued.length,
        ...opts.snapshot,
      };
    },
    startSession() {
      return "session-1";
    },
    recordThought(_sessionId, thoughtRecord) {
      state.thoughts.push(thoughtRecord);
      return `thought-${state.thoughts.length}`;
    },
    apply(result, sessionId) {
      state.applied.push({ result, sessionId });
    },
    setWake(seconds) {
      state.wake = seconds;
    },
    recentLine() {
      return "recent";
    },
    legalUnderlyingBrief() {
      return undefined;
    },
    activeLineageId() {
      return state.activeLineageId;
    },
    createLineageFromSuggestion(suggestionId) {
      const id = `lineage-from-${suggestionId}`;
      state.activeLineageId = id;
      return id;
    },
    pickQueuedSuggestionId() {
      return state.queued[0] ?? null;
    },
  };

  return { store, state };
}

describe("runSession", () => {
  it("loops until minThoughts before accepting the continue_line default", async () => {
    const { store, state } = createStore();
    let calls = 0;
    const model: ModelStep = async () => {
      calls++;
      return { thought: thought(`t${calls}`), endSession: true };
    };

    const result = await runSession(store, model, () => 0, { minThoughts: 3 });

    expect(calls).toBe(3);
    expect(result.thoughtCount).toBe(3);
    expect(result.outcome).toBe("continue_line");
    expect(state.applied.at(-1)?.result.wakeHot).toBe(true);
  });

  it("applies expand with agenda texts once legal and wakes hot", async () => {
    const { store, state } = createStore();
    let calls = 0;
    const model: ModelStep = async () => {
      calls++;
      if (calls === 3) {
        return {
          thought: thought(`t${calls}`),
          outcome: "expand",
          agendaTexts: ["one", "two", "three"],
        };
      }
      return { thought: thought(`t${calls}`) };
    };

    const result = await runSession(store, model, () => 0, { minThoughts: 3 });

    expect(result.thoughtCount).toBe(3);
    expect(result.outcome).toBe("expand");
    expect(state.applied.at(-1)?.result.agendaTexts).toEqual(["one", "two", "three"]);
    expect(state.wake).toBe(45);
  });

  it("applies select_suggestion immediately and later thoughts see the relate brief", async () => {
    const { store, state } = createStore({
      queued: ["sugg-1"],
      snapshot: { hasOpenBranch: false },
    });
    const briefsSeen: BriefType[] = [];
    let calls = 0;
    const model: ModelStep = async ({ brief }) => {
      calls++;
      briefsSeen.push(brief);
      if (calls === 1) {
        return { thought: thought("t1"), outcome: "select_suggestion" };
      }
      return { thought: thought(`t${calls}`), endSession: true };
    };

    const result = await runSession(store, model, () => 0, { minThoughts: 3 });

    expect(briefsSeen).toEqual(["inbox_glance", "relate", "relate"]);
    expect(result.brief).toBe("relate");
    expect(state.activeLineageId).toBe("lineage-from-sugg-1");
    expect(state.applied[0]?.result.nextBriefHint).toBe("relate");
    expect(result.thoughtCount).toBe(3);
  });

  it("wind-down allows an early noop", async () => {
    const { store, state } = createStore();
    let calls = 0;
    const model: ModelStep = async ({ windDown }) => {
      calls++;
      expect(windDown).toBe(true);
      return { thought: thought("t1"), outcome: "noop" };
    };

    const result = await runSession(store, model, () => 0, {
      alarmWallMs: 1000,
      windDownMs: 2000,
    });

    expect(calls).toBe(1);
    expect(result.thoughtCount).toBe(1);
    expect(result.outcome).toBe("noop");
    expect(state.wake).toBe(720);
  });

  it("exits with continue_line before the minimum thought count when aborted", async () => {
    const { store, state } = createStore();
    store.isAborted = () => true;
    const model: ModelStep = async () => {
      throw new Error("model should not run after an abort");
    };

    const result = await runSession(store, model, () => 0, { minThoughts: 3 });

    expect(result.thoughtCount).toBe(0);
    expect(result.outcome).toBe("continue_line");
    expect(state.applied).toHaveLength(1);
    expect(state.applied[0]?.result.wakeHot).toBe(true);
  });
});
