import { DEFAULTS } from "../defaults";
import type { BriefType, LineageStatus, MindSnapshot, Outcome } from "../types";

const CONTINUE_LINE_OUTCOMES: Outcome[] = [
  "continue_line",
  "expand",
  "conclude",
  "park",
  "noop",
];
const PURSUE_AGENDA_OUTCOMES: Outcome[] = ["continue_line", "expand", "conclude", "park"];
const RELATE_OUTCOMES: Outcome[] = ["connected", "unrelated", "dig"];
const INBOX_GLANCE_OUTCOMES: Outcome[] = ["select_suggestion", "ignore_inbox"];
const GROW_FRONTIER_OUTCOMES: Outcome[] = ["continue_line", "expand", "noop"];

export function decideBrief(snapshot: MindSnapshot): BriefType {
  if (snapshot.forcePending) return "relate";
  if (snapshot.talkPending) return "talk";
  if (snapshot.agendaPendingCount > 0) return "pursue_agenda";

  const activeLineage = snapshot.activeLineage;
  if (
    activeLineage?.status === "relating" &&
    activeLineage.digSessions >= 1 &&
    activeLineage.digSessions < DEFAULTS.digCap
  ) {
    return "dig";
  }

  if (snapshot.hasRelatingOpen) return "relate";
  if (snapshot.hasOpenBranch) return "continue_line";
  if (snapshot.queuedCount > 0) return "inbox_glance";
  return "grow_frontier";
}

export function legalOutcomes(
  brief: BriefType,
  context: { underlyingBrief?: BriefType; lineageStatus?: LineageStatus } = {},
): Outcome[] {
  switch (brief) {
    case "continue_line":
      return [...CONTINUE_LINE_OUTCOMES];
    case "pursue_agenda":
      return [...PURSUE_AGENDA_OUTCOMES];
    case "relate":
      return [...RELATE_OUTCOMES];
    case "talk":
      return legalOutcomes(
        context.underlyingBrief && context.underlyingBrief !== "talk"
          ? context.underlyingBrief
          : "continue_line",
        context,
      );
    case "dig":
      return context.lineageStatus === "relating"
        ? [...RELATE_OUTCOMES]
        : [...CONTINUE_LINE_OUTCOMES];
    case "inbox_glance":
      return [...INBOX_GLANCE_OUTCOMES];
    case "grow_frontier":
      return [...GROW_FRONTIER_OUTCOMES];
  }
}

export function mayEndSession({
  thoughtCount,
  minThoughts,
  windDown,
}: {
  thoughtCount: number;
  minThoughts: number;
  windDown: boolean;
}): boolean {
  return windDown || thoughtCount >= minThoughts;
}
