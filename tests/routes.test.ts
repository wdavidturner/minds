import { describe, expect, it } from "vitest";
import { matchRoute } from "../src/routes";

describe("matchRoute", () => {
  it.each([
    ["/", { kind: "gallery" }],
    ["/login", { kind: "login" }],
    ["/op/new", { kind: "op-new" }],
    ["/minds/ada", { kind: "mind-public", slug: "ada" }],
    ["/minds/ada/op", { kind: "mind-op", slug: "ada" }],
    ["/minds/ada/notes/note-1", { kind: "mind-note", slug: "ada", noteId: "note-1" }],
    ["/minds/ada/unknown", { kind: "unknown" }],
  ])("maps %s to its route kind", (pathname, expected) => {
    expect(matchRoute(pathname)).toEqual(expected);
  });
});
