import { isValidSlug } from "../slug";
import { isAllowedModel } from "../models";

export type CreateMindInput = {
  slug: string;
  name: string;
  persona: string;
  core: string;
  model?: string;
};

export function coreSummary(core: string): string {
  return core.slice(0, 160);
}

/**
 * A create can fail after reserving the slug (row inserted `booting`) but
 * before the Mind finishes bootstrapping. Retrying the same slug while it is
 * still `booting` must not be rejected as a duplicate slug.
 */
export function partitionExistingSlugs(
  rows: readonly { slug: string; status: string }[],
  slug: string,
): { retryingBoot: boolean; blockingSlugs: string[] } {
  const retryingBoot = rows.some((row) => row.slug === slug && row.status === "booting");
  const blockingSlugs = rows
    .filter((row) => !(row.slug === slug && row.status === "booting"))
    .map((row) => row.slug);
  return { retryingBoot, blockingSlugs };
}

export function validateCreate(
  input: CreateMindInput,
  existingSlugs: string[],
): { ok: true } | { ok: false; error: string } {
  if (!isValidSlug(input.slug)) {
    return { ok: false, error: "Invalid slug" };
  }

  if (existingSlugs.includes(input.slug)) {
    return { ok: false, error: "Slug already exists" };
  }

  if (!input.name.trim()) {
    return { ok: false, error: "Name is required" };
  }

  if (!input.core.trim()) {
    return { ok: false, error: "Core is required" };
  }

  if (input.model && !isAllowedModel(input.model)) {
    return { ok: false, error: "Unknown model" };
  }

  return { ok: true };
}
