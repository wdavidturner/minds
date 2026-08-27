export function shouldRewriteLearningSummary(newThoughts: readonly string[]): boolean {
  return newThoughts.some((thought) => thought.trim().length > 0);
}

export function learnedParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildLearningSummaryPrompt(input: {
  name: string;
  core: string;
  previous: string;
  newThoughts: readonly string[];
}): string {
  const prior = input.previous.trim() || "(none yet — write the first summary from the new observations)";
  const thoughts = input.newThoughts.map((thought) => `- ${thought.trim()}`).join("\n");
  return [
    `Mind: ${input.name}`,
    `Core question:\n${input.core}`,
    `Existing summary (rewrite this; do not discard what is still true):\n${prior}`,
    `New observations from the latest session:\n${thoughts}`,
    [
      "Rewrite the summary as a brief a curious human would actually want to read.",
      "Prose paragraphs, not a transcript and not a list of thoughts.",
      "Keep prior learning that still holds. Fold in new substance so the text can grow.",
      "Do not invent facts. Do not mention tools, sessions, or that you are summarizing.",
    ].join(" "),
  ].join("\n\n");
}
