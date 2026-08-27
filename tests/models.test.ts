import { describe, expect, it } from "vitest";
import { MODEL_OPTIONS, isAllowedModel, resolveMindModel } from "../src/models";

describe("MODEL_OPTIONS", () => {
  it("includes GLM 5.3 Flash and the other picker models", () => {
    const ids = MODEL_OPTIONS.map((option) => option.id);
    expect(ids).toContain("@cf/zai-org/glm-5.3-flash");
    expect(ids).toContain("@cf/zai-org/glm-4.7-flash");
    expect(ids).toContain("@cf/meta/llama-4-scout-17b-16e-instruct");
    expect(ids).toContain("@cf/qwen/qwen3-30b-a3b-fp8");
    expect(ids).toContain("@cf/moonshotai/kimi-k2.7-code");
  });
});

describe("resolveMindModel", () => {
  const envModel = "@cf/zai-org/glm-4.7-flash";

  it("throws when env MODEL is missing", () => {
    expect(() => resolveMindModel(null, undefined)).toThrow("MODEL is required");
  });

  it("uses the env default when the Mind has no override", () => {
    expect(resolveMindModel(null, envModel)).toBe(envModel);
    expect(resolveMindModel("", envModel)).toBe(envModel);
  });

  it("uses an allowed override", () => {
    expect(resolveMindModel("@cf/zai-org/glm-5.3-flash", envModel)).toBe(
      "@cf/zai-org/glm-5.3-flash",
    );
  });

  it("ignores an unknown override and keeps the env default", () => {
    expect(resolveMindModel("@cf/not-a-model", envModel)).toBe(envModel);
  });
});

describe("isAllowedModel", () => {
  it("accepts allowlisted ids only", () => {
    expect(isAllowedModel("@cf/zai-org/glm-5.3-flash")).toBe(true);
    expect(isAllowedModel("gpt-4")).toBe(false);
  });
});
