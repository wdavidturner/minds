import { describe, expect, it } from "vitest";
import { isValidSlug, slugify } from "../src/slug";

describe("slugify", () => {
  it("kebabs and lowercases", () => {
    expect(slugify("Ada the Mind")).toBe("ada-the-mind");
  });
  it("rejects empty after strip", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Ada")).toBe(false);
    expect(isValidSlug("ada")).toBe(true);
    expect(isValidSlug("ada-the-mind")).toBe(true);
  });
});
