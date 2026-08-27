import { describe, expect, it } from "vitest";
import { checkOutcome } from "../src/mind/tool-guards";

describe("checkOutcome", () => {
  it("accepts an outcome that is legal for the brief", () => {
    expect(checkOutcome("connected", ["connected", "unrelated", "dig"])).toEqual({ ok: true });
  });

  it("returns a tool error for an outcome illegal in this brief, not a false ok", () => {
    const result = checkOutcome("expand", ["connected", "unrelated", "dig"]);
    expect(result.ok).toBe(false);
    expect(result).not.toEqual({ ok: true });
    if (!result.ok) {
      expect(result.error).toMatch(/illegal/i);
      expect(result.error).toContain("expand");
    }
  });
});
