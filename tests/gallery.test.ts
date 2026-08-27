import { describe, expect, it } from "vitest";
import { gallery } from "../src/html/gallery";

const minds = [
  {
    slug: "family-hub-one",
    name: "Family hub",
    core_summary: "Topic: family hub — how a household actually holds together.",
    status: "live",
  },
];

describe("gallery", () => {
  it("shows public and operator buttons on each mind", () => {
    const html = gallery(minds);
    expect(html).toContain("Family hub");
    expect(html).toContain("Topic: family hub");
    expect(html).toContain('class="btn" href="/minds/family-hub-one"');
    expect(html).toContain("Public page");
    expect(html).toContain('class="btn ghost" href="/minds/family-hub-one/op"');
    expect(html).toContain("Operator");
  });

  it("links to the operator panel from the header", () => {
    const html = gallery(minds);
    expect(html).toContain('href="/op/directory"');
    expect(html).toContain("Operator panel");
    expect(html).toContain("dir-head");
    expect(html).toContain("dir-grid");
  });

  it("shows an empty state", () => {
    expect(gallery([])).toContain("No minds yet");
  });
});
