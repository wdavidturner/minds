import { describe, expect, it } from "vitest";
import {
  coreSummary,
  partitionExistingSlugs,
  validateCreate,
  type CreateMindInput,
} from "../src/directory/index-logic";
import {
  DEFAULT_TEMPERAMENT_JSON,
  DIRECTORY_DDL,
  DIRECTORY_STATUSES,
  type DirectoryStatus,
} from "../src/directory/schema";

const validInput: CreateMindInput = {
  slug: "ada",
  name: "Ada",
  persona: "",
  core: "A thoughtful and curious mind.",
};

describe("validateCreate", () => {
  it("rejects an invalid slug", () => {
    expect(validateCreate({ ...validInput, slug: "Ada Mind" }, [])).toEqual({
      ok: false,
      error: "Invalid slug",
    });
  });

  it("rejects an exact duplicate slug", () => {
    expect(validateCreate(validInput, ["ada"])).toEqual({
      ok: false,
      error: "Slug already exists",
    });
  });

  it.each([
    ["name", { ...validInput, name: "  " }, "Name is required"],
    ["core", { ...validInput, core: "\n\t" }, "Core is required"],
  ])("rejects an empty %s", (_field, input, error) => {
    expect(validateCreate(input, [])).toEqual({ ok: false, error });
  });

  it("allows an empty persona for a valid unique mind", () => {
    expect(validateCreate(validInput, [])).toEqual({ ok: true });
  });
});

describe("partitionExistingSlugs", () => {
  it("does not block a retry of a slug still booting", () => {
    const rows = [{ slug: "ada", status: "booting" }];
    expect(partitionExistingSlugs(rows, "ada")).toEqual({
      retryingBoot: true,
      blockingSlugs: [],
    });
  });

  it("blocks a live or archived slug from being reused", () => {
    expect(
      partitionExistingSlugs([{ slug: "ada", status: "live" }], "ada"),
    ).toEqual({ retryingBoot: false, blockingSlugs: ["ada"] });
    expect(
      partitionExistingSlugs([{ slug: "ada", status: "archived" }], "ada"),
    ).toEqual({ retryingBoot: false, blockingSlugs: ["ada"] });
  });

  it("leaves unrelated slugs blocking regardless of status", () => {
    const rows = [
      { slug: "ada", status: "booting" },
      { slug: "grace", status: "live" },
    ];
    expect(partitionExistingSlugs(rows, "ada")).toEqual({
      retryingBoot: true,
      blockingSlugs: ["grace"],
    });
  });
});

describe("coreSummary", () => {
  it("returns only the first 160 characters", () => {
    expect(coreSummary(`${"a".repeat(160)}tail`)).toBe("a".repeat(160));
  });
});

describe("DIRECTORY_DDL", () => {
  it("defines the directory table schema", () => {
    expect(DIRECTORY_DDL).toBe(`CREATE TABLE IF NOT EXISTS minds (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  core_summary TEXT NOT NULL,
  temperament_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);`);
  });

  it("exports the allowed directory statuses", () => {
    const statuses: readonly DirectoryStatus[] = [
      "booting",
      "live",
      "archived",
    ];

    expect(DIRECTORY_STATUSES).toEqual(statuses);
  });

  it("exports the default temperament as JSON", () => {
    expect(DEFAULT_TEMPERAMENT_JSON).toBe(
      '{"branching":0.5,"persistence":0.5,"curiosity":0.5,"distance":0.5}',
    );
  });
});
