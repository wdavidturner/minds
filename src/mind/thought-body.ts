import type { ThoughtRecord } from "./session-loop";

const BODY_ARG =
  /<arg_key>\s*body\s*<\/arg_key>\s*<arg_value>([\s\S]*?)(?:<\/arg_value>|$)/i;
const DISTANCE_ARG =
  /<arg_key>\s*distanceToCore\s*<\/arg_key>\s*<arg_value>\s*([0-9.]+)\s*(?:<\/arg_value>|$)/i;

function dumpedToolCall(raw: string): boolean {
  return /<tool_call\b/i.test(raw) || /<arg_key>/i.test(raw);
}

function truncatedDump(raw: string): boolean {
  return dumpedToolCall(raw) && !/<\/arg_value>/i.test(raw);
}

function lastCompleteSentence(text: string): string {
  const match = text.match(/^[\s\S]*[.!?](?=["')\]]|\s|$)/);
  return (match ? match[0] : text).trim();
}

export function extractThoughtBody(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  const xmlBody = BODY_ARG.exec(text)?.[1]?.split(/<arg_key>/i)[0];
  const source = (xmlBody ?? (dumpedToolCall(text) ? "" : text)).replace(
    /<\/?(?:tool_call|arg_key|arg_value)[^>]*>/gi,
    "",
  );
  const cleaned = source.replace(/^\s*record_thought\s*/i, "").trim();
  if (!cleaned) return "";
  if (truncatedDump(text) || xmlBody !== undefined && !/<\/arg_value>/i.test(text)) {
    return lastCompleteSentence(cleaned);
  }
  return cleaned;
}

export function extractDistanceToCore(raw: string): number | undefined {
  const match = DISTANCE_ARG.exec(raw);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/** Prose for display or storage. Dumped tool-call markup never survives. */
export function presentThoughtBody(raw: string): string {
  const cleaned = extractThoughtBody(raw);
  if (cleaned) return cleaned;
  return dumpedToolCall(raw) ? "" : raw.trim();
}

const PLACEHOLDER_THOUGHT = /^continue examining the core\.?$/i;

export function isVisibleThoughtBody(raw: string): boolean {
  const text = presentThoughtBody(raw);
  if (!text) return false;
  if (PLACEHOLDER_THOUGHT.test(text)) return false;
  if (/tool_call|<\s*arg_key|arg_value/i.test(text)) return false;
  return true;
}

export function thoughtFromModelStep(
  recorded: ThoughtRecord | undefined,
  resultText: string,
): ThoughtRecord {
  if (recorded) {
    return {
      ...recorded,
      body: presentThoughtBody(recorded.body) || recorded.body,
    };
  }
  return {
    body: presentThoughtBody(resultText),
    distanceToCore: extractDistanceToCore(resultText) ?? 0,
    parentId: null,
  };
}
