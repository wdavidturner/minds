import type {
  BriefType,
  LineageKind,
  LineageStatus,
  Outcome,
} from "../types";

export type IdentityRow = {
  slug: string;
  name: string;
  persona: string;
  core: string;
  temperament_json: string;
  paused: number;
  created_at: number;
  model?: string | null;
};

export type LineageRow = {
  id: string;
  kind: LineageKind;
  suggestion_id: string | null;
  status: LineageStatus;
  stashed_from_lineage_id: string | null;
  dig_sessions: number;
  created_at: number;
  closed_at: number | null;
};

export type SessionRow = {
  id: string;
  brief_type: BriefType;
  lineage_id: string;
  started_at: number;
  ended_at: number;
  outcome: Outcome | null;
  thought_count: number;
};

export type ThoughtRow = {
  id: string;
  session_id: string;
  lineage_id: string;
  suggestion_id: string | null;
  parent_id: string | null;
  body: string;
  distance_to_core: number;
  created_at: number;
};

export type AgendaItemRow = {
  id: string;
  lineage_id: string;
  origin_session_id: string;
  origin_thought_id: string;
  text: string;
  status: "pending" | "active" | "done";
};

export type GraphPayload = {
  slug: string;
  name: string;
  core: string;
  model?: string;
  pondering?: boolean;
  paused?: boolean;
  lineages: LineageRow[];
  sessions: SessionRow[];
  thoughts: ThoughtRow[];
  agenda: AgendaItemRow[];
};

export function buildGraphPayload(
  identityRows: readonly IdentityRow[],
  lineageRows: readonly LineageRow[],
  sessionRows: readonly SessionRow[],
  thoughtRows: readonly ThoughtRow[],
  agendaItemRows: readonly AgendaItemRow[],
): GraphPayload {
  const identity = identityRows[0];

  if (!identity) {
    throw new Error("Mind identity row is required");
  }

  return {
    slug: identity.slug,
    name: identity.name,
    core: identity.core,
    lineages: [...lineageRows],
    sessions: [...sessionRows],
    thoughts: [...thoughtRows],
    agenda: [...agendaItemRows],
  };
}
