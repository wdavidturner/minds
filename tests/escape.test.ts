import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/html/layout";

describe("escapeHtml", () => {
  it("escapes HTML-sensitive characters", () => {
    expect(escapeHtml(`& < > "`)).toBe("&amp; &lt; &gt; &quot;");
  });
});
