import { describe, expect, it } from "vitest";
import { directoryDashboard } from "../src/html/directory-dashboard";

const minds = [
  {
    slug: "family-hub-one",
    name: "Family hub",
    core_summary: "Topic: family hub — how a household actually holds together.",
    status: "live",
  },
];

describe("directoryDashboard", () => {
  it("lists minds as cards that open the operator view", () => {
    const html = directoryDashboard(minds);
    expect(html).toContain("Family hub");
    expect(html).toContain("family-hub-one");
    expect(html).toContain("Topic: family hub");
    expect(html).toContain('href="/minds/family-hub-one/op"');
    expect(html).toContain("live");
    expect(html).not.toContain("/op/directory/chat");
  });

  it("has a new mind button and an empty state", () => {
    expect(directoryDashboard(minds)).toContain('href="/op/new"');
    const empty = directoryDashboard([]);
    expect(empty).toContain("No minds yet");
    expect(empty).toContain('href="/op/new"');
  });
});
