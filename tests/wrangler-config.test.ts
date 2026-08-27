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

  it("attaches the production custom domain", () => {
    expect(config.routes).toEqual([
      { pattern: "minds.intentionality.software", custom_domain: true },
    ]);
  });

  it("pins the Intentionality Software account for CI deploys", () => {
    expect(config.account_id).toBe("5a8e7d04d1a54d85c74cb6fc50336a45");
  });
});
