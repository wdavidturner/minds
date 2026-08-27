import { describe, expect, it } from "vitest";
import { activeLineageOrFallback, shouldWakeOnVerb } from "../src/mind/verbs";

describe("shouldWakeOnVerb", () => {
  it("does not wake for queue but wakes for force and talk", () => {
    expect(shouldWakeOnVerb("queue")).toBe(false);
    expect(shouldWakeOnVerb("force")).toBe(true);
    expect(shouldWakeOnVerb("talk")).toBe(true);
  });
});

describe("activeLineageOrFallback", () => {
  const core = { id: "core", kind: "core" as const, status: "exploring" as const, createdAt: 1 };
  const olderOpen = { id: "older", kind: "suggestion" as const, status: "exploring" as const, createdAt: 2 };
  const latestOpen = { id: "latest", kind: "suggestion" as const, status: "relating" as const, createdAt: 3 };
  const active = { id: "active", kind: "suggestion" as const, status: "exploring" as const, createdAt: 0, active: true };

  it("chooses the active lineage before other open lineages", () => {
    expect(activeLineageOrFallback([core, latestOpen, active])).toBe(active);
  });

  it("chooses the latest open lineage when none is active", () => {
    expect(activeLineageOrFallback([core, olderOpen, latestOpen])).toBe(latestOpen);
  });

  it("falls back to the core lineage when none are open", () => {
    expect(activeLineageOrFallback([
      core,
      { id: "closed", kind: "suggestion", status: "concluded", createdAt: 4 },
    ])).toBe(core);
  });
});
