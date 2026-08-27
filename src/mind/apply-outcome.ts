import type { BriefType, LineageKind, LineageStatus, Outcome } from "../types";

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
  /** Set for every outcome except select_suggestion/ignore_inbox, which do not end the session. */
  outcome?: Outcome;
  /** conclude/park inside pursue_agenda close the agenda item, not the lineage. */
  agendaItemDone?: boolean;
};

/**
 * Session-ending outcomes never end kind=core lineages: the core is the one
 * lineage every Mind must always have open. Guard here so conclude/park/
 * unrelated on the core just idle the session instead of closing it.
 */
function closableLineage(
  activeLineageId: string | null,
  activeLineageKind: LineageKind | undefined,
  patch: Omit<LineagePatch, "id">,
): LineagePatch | null {
  if (activeLineageId === null || activeLineageKind === "core") return null;
  return { id: activeLineageId, ...patch };
}

export function applyOutcome({
  outcome,
  brief,
  activeLineageId,
  activeLineageKind,
  agendaTexts,
}: {
  outcome: Outcome;
  brief: BriefType;
  activeLineageId: string | null;
  activeLineageKind?: LineageKind;
  agendaTexts?: string[];
}): ApplyResult {
  const pending = brief === "relate"
    ? { clearForce: true }
    : brief === "talk"
      ? { clearTalk: true }
      : {};
  const finish = (
    result: Omit<ApplyResult, "clearForce" | "clearTalk" | "outcome">,
  ): ApplyResult => ({
    ...result,
    ...pending,
    ...(outcome === "select_suggestion" || outcome === "ignore_inbox" ? {} : { outcome }),
  });

  switch (outcome) {
    case "continue_line":
      return finish({ lineage: null, wakeHot: true });
    case "expand":
      return finish({ lineage: null, agendaTexts, wakeHot: true });
    case "conclude":
      if (brief === "pursue_agenda") {
        return finish({ lineage: null, agendaItemDone: true, wakeHot: false });
      }
      return finish({
        lineage: closableLineage(activeLineageId, activeLineageKind, {
          status: "concluded",
          closed: true,
        }),
        wakeHot: false,
      });
    case "park":
      if (brief === "pursue_agenda") {
        return finish({ lineage: null, agendaItemDone: true, wakeHot: false });
      }
      return finish({
        lineage: closableLineage(activeLineageId, activeLineageKind, {
          status: "parked",
          closed: true,
        }),
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
        lineage: closableLineage(activeLineageId, activeLineageKind, {
          status: "unrelated",
          closed: true,
          restoreStash: true,
        }),
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
