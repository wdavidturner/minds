import type { Outcome } from "../types";

/**
 * Legal-only set_outcome: illegal tool calls must return a tool error so the
 * model learns its choice did not stick, instead of a blanket `{ ok: true }`
 * that leaves it believing the outcome applied.
 */
export function checkOutcome(
  outcome: Outcome,
  legal: readonly Outcome[],
): { ok: true } | { ok: false; error: string } {
  if (!legal.includes(outcome)) {
    return { ok: false, error: `Illegal outcome "${outcome}" for the current brief.` };
  }
  return { ok: true };
}
