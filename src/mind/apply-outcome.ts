import type { BriefType, LineageStatus, Outcome } from "../types";

export type LineagePatch = {
  id: string;
  status?: LineageStatus;
  digSessions?: number;
  closed?: boolean;
  restoreStash?: boolean;
};

export type ApplyResult = {
  lineage: LineagePatch | null;
  agendaTexts?: string[];
  wakeHot: boolean;
  nextBriefHint?: BriefType;
  clearForce?: boolean;
  clearTalk?: boolean;
  dismissSuggestion?: boolean;
};

export function applyOutcome({
  outcome,
  brief,
  activeLineageId,
  agendaTexts,
}: {
  outcome: Outcome;
  brief: BriefType;
  activeLineageId: string | null;
  agendaTexts?: string[];
}): ApplyResult {
  const pending = brief === "relate"
    ? { clearForce: true }
    : brief === "talk"
      ? { clearTalk: true }
      : {};
  const finish = (result: Omit<ApplyResult, "clearForce" | "clearTalk">): ApplyResult => ({
    ...result,
    ...pending,
  });

  switch (outcome) {
    case "continue_line":
      return finish({ lineage: null, wakeHot: true });
    case "expand":
      return finish({ lineage: null, agendaTexts, wakeHot: true });
    case "conclude":
      return finish({
        lineage:
          activeLineageId === null
            ? null
            : { id: activeLineageId, status: "concluded", closed: true },
        wakeHot: false,
      });
    case "park":
      return finish({
        lineage:
          activeLineageId === null
            ? null
            : { id: activeLineageId, status: "parked", closed: true },
        wakeHot: false,
      });
    case "noop":
      return finish({ lineage: null, wakeHot: false });
    case "connected":
      return finish({
        lineage:
          activeLineageId === null
            ? null
            : { id: activeLineageId, status: "connected" },
        wakeHot: true,
      });
    case "unrelated":
      return finish({
        lineage:
          activeLineageId === null
            ? null
            : {
                id: activeLineageId,
                status: "unrelated",
                closed: true,
                restoreStash: true,
              },
        wakeHot: false,
      });
    case "dig":
      return finish({
        lineage:
          activeLineageId === null
            ? null
            : {
                id: activeLineageId,
                // A patch value of 1 means increment by one; the SQL layer adds it.
                digSessions: 1,
              },
        wakeHot: true,
      });
    case "select_suggestion":
      return finish({ lineage: null, nextBriefHint: "relate", wakeHot: true });
    case "ignore_inbox":
      return finish({ lineage: null, nextBriefHint: "grow_frontier", wakeHot: true });
  }
}

export function nextWakeSeconds(
  result: ApplyResult,
  defaults: { hotSleepSeconds: number; idleSleepSeconds: number },
): number {
  return result.wakeHot ? defaults.hotSleepSeconds : defaults.idleSleepSeconds;
}
