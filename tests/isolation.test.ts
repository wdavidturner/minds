import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("isolation", () => {
  it("Mind module does not look up other Minds", () => {
    const src = readFileSync("src/mind/mind.ts", "utf8");
    expect(src).not.toMatch(/getAgentByName/);
  });
});
