import { describe, expect, it } from "vitest";
import {
  buildLearningSummaryPrompt,
  learnedParagraphs,
  shouldRewriteLearningSummary,
} from "../src/mind/learning-summary";

describe("shouldRewriteLearningSummary", () => {
  it("rewrites only when there are new observations", () => {
    expect(shouldRewriteLearningSummary([])).toBe(false);
    expect(shouldRewriteLearningSummary(["Banks set the pace."])).toBe(true);
  });
});

describe("buildLearningSummaryPrompt", () => {
  it("asks for a human-readable rewrite that keeps prior learning and adds the new thoughts", () => {
    const prompt = buildLearningSummaryPrompt({
      name: "Future of Cannabis",
      core: "What does the next twenty years of cannabis actually look like?",
      previous: "Banking access is the first choke point.",
      newThoughts: ['What does "capital control" look like beyond basic banking access?'],
    });

    expect(prompt).toContain("Future of Cannabis");
    expect(prompt).toContain("What does the next twenty years");
    expect(prompt).toContain("Banking access is the first choke point.");
    expect(prompt).toContain("capital control");
    expect(prompt).toContain("rewrite");
    expect(prompt).toMatch(/human/i);
    expect(prompt).not.toContain("Continue examining the core.");
  });
});

describe("learnedParagraphs", () => {
  it("splits a summary into paragraphs for display", () => {
    expect(learnedParagraphs("One point.\n\nAnother point.")).toEqual(["One point.", "Another point."]);
  });
});
