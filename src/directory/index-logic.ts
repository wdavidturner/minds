import { isValidSlug } from "../slug";

export type CreateMindInput = {
  slug: string;
  name: string;
  persona: string;
  core: string;
};

export function coreSummary(core: string): string {
  return core.slice(0, 160);
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

  return { ok: true };
}
