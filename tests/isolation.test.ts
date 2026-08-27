import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("isolation", () => {
  it("Mind module does not look up other Minds", () => {
    const src = readFileSync("src/mind/mind.ts", "utf8");
    expect(src).not.toMatch(/getAgentByName/);
  });

  it("requires MODEL instead of hard-coding a model fallback", () => {
    const directory = readFileSync("src/directory/directory.ts", "utf8");
    const mind = readFileSync("src/mind/mind.ts", "utf8");

    expect(directory).not.toMatch(/@cf\/meta\/llama-3\.1-8b-instruct/);
    expect(mind).not.toMatch(/@cf\/meta\/llama-3\.1-8b-instruct/);
    expect(directory).toMatch(/if \(!this\.env\.MODEL\) throw new Error/);
    expect(mind).toMatch(/if \(!this\.env\.MODEL\) throw new Error/);
  });

  it("treats unsuccessful fetch responses as fetch_url errors", () => {
    const src = readFileSync("src/mind/mind.ts", "utf8");
    expect(src).toMatch(/if \(!response\.ok\) return \{ error:/);
  });
});
