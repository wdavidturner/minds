import { describe, expect, it } from "vitest";
import { buildPonderPrompt } from "../src/mind/prompt";

const base = {
  persona: "A careful observer.",
  core: "Notice patterns in ordinary things.",
  legal: ["continue_line", "expand", "conclude", "park", "noop"] as const,
  elapsedMs: 1_000,
  remainingMs: 60_000,
  windDown: false,
};

describe("buildPonderPrompt", () => {
  it("injects queued suggestion ids and text for inbox_glance", () => {
    const prompt = buildPonderPrompt({
      ...base,
      brief: "inbox_glance",
      legal: ["select_suggestion", "ignore_inbox"],
      text: {
        queuedSuggestions: [
          { id: "sugg-1", text: "What about rice prices?" },
          { id: "sugg-2", text: "Consider a nearby hub." },
        ],
        talkTexts: [],
        minThoughts: 8,
      },
    });

    expect(prompt).toContain("sugg-1: What about rice prices?");
    expect(prompt).toContain("sugg-2: Consider a nearby hub.");
  });

  it("injects the probe text for relate/dig", () => {
    const prompt = buildPonderPrompt({
      ...base,
      brief: "relate",
      legal: ["connected", "unrelated", "dig"],
      text: {
        queuedSuggestions: [],
        probeText: "Is a shared calendar related to the core topic?",
        talkTexts: [],
        minThoughts: 8,
      },
    });

    expect(prompt).toContain("Is a shared calendar related to the core topic?");
  });

  it("injects talk utterances for the talk brief", () => {
    const prompt = buildPonderPrompt({
      ...base,
      brief: "talk",
      legal: ["continue_line", "expand", "conclude", "park", "noop"],
      text: {
        queuedSuggestions: [],
        talkTexts: ["Have you considered the cost angle?"],
        minThoughts: 8,
      },
    });

    expect(prompt).toContain("Have you considered the cost angle?");
  });

  it("injects the pending agenda item text for pursue_agenda", () => {
    const prompt = buildPonderPrompt({
      ...base,
      brief: "pursue_agenda",
      legal: ["continue_line", "expand", "conclude", "park"],
      text: {
        queuedSuggestions: [],
        talkTexts: [],
        agendaItemText: "Explore the nearby example further.",
        minThoughts: 8,
      },
    });

    expect(prompt).toContain("Explore the nearby example further.");
  });

  it("always states the session minimum thought count", () => {
    const prompt = buildPonderPrompt({
      ...base,
      brief: "grow_frontier",
      legal: ["continue_line", "expand", "noop"],
      text: { queuedSuggestions: [], talkTexts: [], minThoughts: 8 },
    });

    expect(prompt).toContain("Minimum thoughts this session: 8");
  });

  it("omits operator-text sections that have nothing to say", () => {
    const prompt = buildPonderPrompt({
      ...base,
      brief: "grow_frontier",
      legal: ["continue_line", "expand", "noop"],
      text: { queuedSuggestions: [], talkTexts: [], minThoughts: 8 },
    });

    expect(prompt).not.toContain("Queued suggestions");
    expect(prompt).not.toContain("Probe under consideration");
    expect(prompt).not.toContain("The operator said");
    expect(prompt).not.toContain("Agenda item you are pursuing");
  });
});
