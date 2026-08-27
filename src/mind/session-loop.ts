import { applyOutcome, nextWakeSeconds, type ApplyResult } from "./apply-outcome";
import { decideBrief, legalOutcomes, mayEndSession } from "./brief";
import { DEFAULTS } from "../defaults";
import type { BriefType, MindSnapshot, Outcome } from "../types";

export type ThoughtRecord = {
  body: string;
  distanceToCore: number;
  parentId: string | null;
};

export type SessionStore = {
  snapshot(): MindSnapshot;
  startSession(brief: BriefType, lineageId: string | null): string;
  recordThought(sessionId: string, thought: ThoughtRecord): string;
  apply(result: ApplyResult, sessionId: string): void;
  setWake(seconds: number): void;
  recentLine(lineageId: string | null): string;
  legalUnderlyingBrief(): BriefType | undefined;
  activeLineageId(): string | null;
  createLineageFromSuggestion(suggestionId: string): string;
  pickQueuedSuggestionId(): string | null;
  isAborted?(): boolean;
};

export type ModelStep = (input: {
  brief: BriefType;
  legal: Outcome[];
  recent: string;
  thoughtCount: number;
  elapsedMs: number;
  remainingMs: number;
  windDown: boolean;
}) => Promise<{
  thought: ThoughtRecord;
  outcome?: Outcome;
  agendaTexts?: string[];
  suggestionId?: string;
  endSession?: boolean;
}>;

export async function runSession(
  store: SessionStore,
  model: ModelStep,
  now: () => number,
  opts?: { minThoughts?: number; alarmWallMs?: number; windDownMs?: number },
): Promise<{ sessionId: string; brief: BriefType; thoughtCount: number; outcome: Outcome }> {
  const minThoughts = opts?.minThoughts ?? DEFAULTS.minThoughts;
  const alarmWallMs = opts?.alarmWallMs ?? DEFAULTS.alarmWallMs;
  const windDownMs = opts?.windDownMs ?? DEFAULTS.windDownMs;

  let brief = decideBrief(store.snapshot());
  const sessionId = store.startSession(brief, store.activeLineageId());
  const start = now();

  let outcome: Outcome | undefined;
  let applyResult: ApplyResult = { lineage: null, wakeHot: false };
  let count = 0;

  while (true) {
    if (store.isAborted?.()) break;

    const elapsedMs = now() - start;
    const remainingMs = alarmWallMs - elapsedMs;
    const windDown = remainingMs <= windDownMs;

    const legal = legalOutcomes(brief, {
      underlyingBrief: store.legalUnderlyingBrief(),
      lineageStatus: store.snapshot().activeLineage?.status,
    });

    const step = await model({
      brief,
      legal,
      recent: store.recentLine(store.activeLineageId()),
      thoughtCount: count,
      elapsedMs,
      remainingMs,
      windDown,
    });

    if (store.isAborted?.()) break;

    store.recordThought(sessionId, step.thought);
    count++;

    if (step.outcome === "select_suggestion") {
      const suggestionId = step.suggestionId ?? store.pickQueuedSuggestionId();
      if (suggestionId) store.createLineageFromSuggestion(suggestionId);
      applyResult = applyOutcome({
        outcome: "select_suggestion",
        brief,
        activeLineageId: store.activeLineageId(),
      });
      store.apply(applyResult, sessionId);
      brief = "relate";
      continue;
    }

    if (step.outcome === "ignore_inbox") {
      applyResult = applyOutcome({
        outcome: "ignore_inbox",
        brief,
        activeLineageId: store.activeLineageId(),
      });
      store.apply(applyResult, sessionId);
      brief = "grow_frontier";
      continue;
    }

    const mayEnd = mayEndSession({ thoughtCount: count, minThoughts, windDown });

    if (step.outcome && legal.includes(step.outcome) && mayEnd) {
      applyResult = applyOutcome({
        outcome: step.outcome,
        brief,
        activeLineageId: store.activeLineageId(),
        agendaTexts: step.agendaTexts,
      });
      store.apply(applyResult, sessionId);
      outcome = step.outcome;
      break;
    }

    if (step.endSession && mayEnd) break;

    if (remainingMs <= 0) break;
  }

  if (!outcome) {
    outcome = "continue_line";
    applyResult = applyOutcome({
      outcome: "continue_line",
      brief,
      activeLineageId: store.activeLineageId(),
    });
    store.apply(applyResult, sessionId);
  }

  store.setWake(nextWakeSeconds(applyResult, DEFAULTS));

  return { sessionId, brief, thoughtCount: count, outcome };
}
