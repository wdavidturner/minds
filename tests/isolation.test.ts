import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("isolation", () => {
  it("Mind modules do not look up other Minds", () => {
    const sources = readdirSync("src/mind")
      .filter((entry) => entry.endsWith(".ts"))
      .map((entry) => readFileSync(join("src/mind", entry), "utf8"));

    expect(sources.join("\n")).not.toMatch(/getAgentByName/);
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
