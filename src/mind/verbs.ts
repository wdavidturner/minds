import type { LineageKind, LineageStatus } from "../types";

export type Verb = "queue" | "force" | "talk";

export type VerbLineage = {
  id: string;
  kind: LineageKind;
  status: LineageStatus;
  createdAt: number;
  active?: boolean;
};

export function shouldWakeOnVerb(verb: Verb): boolean {
  return verb !== "queue";
}

export function activeLineageOrFallback(lineages: readonly VerbLineage[]): VerbLineage {
  const active = lineages.find((lineage) => lineage.active);
  if (active) return active;

  const latestOpen = lineages
    .filter((lineage) => lineage.status === "relating" || lineage.status === "exploring")
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (latestOpen) return latestOpen;

  const core = lineages.find((lineage) => lineage.kind === "core");
  if (!core) throw new Error("Core lineage is required");
  return core;
}
