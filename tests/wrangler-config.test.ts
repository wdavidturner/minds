import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("wrangler.jsonc", () => {
  const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));

  it("binds the assets fetcher so env.ASSETS exists", () => {
    expect(config.assets).toMatchObject({
      directory: "public",
      binding: "ASSETS",
      run_worker_first: true,
    });
  });
});
