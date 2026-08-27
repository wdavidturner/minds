export type BriefType =
  | "relate"
  | "talk"
  | "pursue_agenda"
  | "dig"
  | "continue_line"
  | "inbox_glance"
  | "grow_frontier";

export type Outcome =
  | "continue_line"
  | "expand"
  | "conclude"
  | "park"
  | "noop"
  | "connected"
  | "unrelated"
  | "dig"
  | "select_suggestion"
  | "ignore_inbox";

export type LineageStatus =
  | "relating"
  | "connected"
  | "exploring"
  | "unrelated"
  | "concluded"
  | "parked";

export type LineageKind = "core" | "suggestion";

export type MindSnapshot = {
  paused: boolean;
  forcePending: boolean;
  talkPending: boolean;
  agendaPendingCount: number;
  activeLineage: {
    id: string;
    status: LineageStatus;
    kind: LineageKind;
    digSessions: number;
  } | null;
  hasRelatingOpen: boolean;
  hasOpenBranch: boolean;
  queuedCount: number;
};
