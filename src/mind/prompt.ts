import type { BriefType, Outcome } from "../types";

export type PonderTextContext = {
  /** Queued suggestions the model may select_suggestion by id. */
  queuedSuggestions: { id: string; text: string }[];
  /** The suggestion text behind the current relate/dig probe. */
  probeText?: string;
  /** Unconsumed operator talk utterances. */
  talkTexts: string[];
  /** The agenda item text being worked under pursue_agenda. */
  agendaItemText?: string;
  minThoughts: number;
};

/**
 * Pure prompt assembly so operator text (queue/force/talk/agenda) is always
 * visible to the model — without this, the loop gates the brief correctly but
 * the model never actually sees what the operator asked about.
 */
export function buildPonderPrompt(input: {
  persona: string;
  core: string;
  brief: BriefType;
  legal: readonly Outcome[];
  elapsedMs: number;
  remainingMs: number;
  windDown: boolean;
  text: PonderTextContext;
}): string {
  const lines = [
    `Persona:\n${input.persona}`,
    `Core:\n${input.core}`,
    `Brief: ${input.brief}`,
    `Legal outcomes: ${input.legal.join(", ")}`,
    `Elapsed milliseconds: ${input.elapsedMs}`,
    `Remaining milliseconds: ${input.remainingMs}`,
    `Wind down: ${input.windDown}`,
    `Minimum thoughts this session: ${input.text.minThoughts}`,
  ];

  if (input.text.queuedSuggestions.length > 0) {
    lines.push(
      `Queued suggestions (pass one id to select_suggestion, or ignore_inbox):\n${input.text.queuedSuggestions
        .map((suggestion) => `- ${suggestion.id}: ${suggestion.text}`)
        .join("\n")}`,
    );
  }

  if (input.text.probeText) {
    lines.push(`Probe under consideration: ${input.text.probeText}`);
  }

  if (input.text.talkTexts.length > 0) {
    lines.push(`The operator said:\n${input.text.talkTexts.join("\n")}`);
  }

  if (input.text.agendaItemText) {
    lines.push(`Agenda item you are pursuing: ${input.text.agendaItemText}`);
  }

  lines.push("Use record_thought once. Use set_outcome only with a legal outcome when ready.");

  return lines.join("\n\n");
}
