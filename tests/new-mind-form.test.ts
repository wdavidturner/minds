import { describe, expect, it } from "vitest";
import { newMindFields } from "../src/html/new-mind-form";

describe("newMindFields", () => {
  it("renders the complete new mind fields", () => {
    const html = newMindFields();

    expect(html).toContain('name="slug"');
    expect(html).toContain('name="name"');
    expect(html).toContain('name="persona"');
    expect(html).toContain('name="core"');
  });
});
