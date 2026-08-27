import type { GraphPayload } from "../mind/graph";
import { layout } from "./layout";
import { mindDashboard } from "./mind-dashboard";

export function mindPublic(graph: GraphPayload, notes: readonly { id: string }[] = []): string {
  return layout(graph.name, mindDashboard(graph, notes), {
    bodyClass: "is-dashboard",
    scripts: ["/mind-dashboard.js"],
  });
}
