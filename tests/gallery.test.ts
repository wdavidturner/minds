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
    expect(html).not.toContain('class="slug"');
    expect(html).not.toMatch(/<p class="slug">family-hub-one<\/p>/);
    expect(html).toContain("Public page");
    expect(html).toContain('class="btn ghost" href="/minds/family-hub-one/op"');
    expect(html).toContain("Operator");
  });

  it("hides the operator panel unless the visitor is logged in", () => {
    const html = gallery(minds);
    expect(html).not.toContain("Operator panel");
    expect(html).not.toContain('href="/op/directory"');
  });

  it("links to the operator panel from the header when logged in", () => {
    const html = gallery(minds, { operator: true });
    expect(html).toContain('href="/op/directory"');
    expect(html).toContain("Operator panel");
    expect(html).toContain("dir-head");
    expect(html).toContain("dir-grid");
  });

  it("shows an empty state", () => {
    expect(gallery([])).toContain("No minds yet");
  });

  it("uses the brain mark as the site logo", () => {
    const html = gallery(minds);
    expect(html).toContain("brand-mark");
    expect(html).toContain("🧠");
    expect(html).not.toMatch(/brand-mark">M</);
  });
});
