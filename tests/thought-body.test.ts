import { describe, expect, it } from "vitest";
import {
  extractThoughtBody,
  isVisibleThoughtBody,
  presentThoughtBody,
  thoughtFromModelStep,
} from "../src/mind/thought-body";

const xmlDump = `<tool_call>record_thought<arg_key>body</arg_key><arg_value>Concrete mechanism: The regulatory state's opacity becomes a consolidation pressure. A certification from the FDA's Office of Orphan Drug Development for "CBG for anxiety" costs roughly $15,000 in clinical data plus $500K in trial design—small growers can't do this; meanwhile, Curaleaf or WellPath can file a supplemental New Drug Application under the orphan pathway and embed that cost as a Moat. The real frontier isn't ballot measures—it's whether your farm has a separate payroll terminal integration test for the bank that wants to avoid OFAC/FinCEN/Consolidated Appropriations Act compliance. If the integration test takes three months and costs $80,000, theة`;

describe("extractThoughtBody", () => {
  it("leaves ordinary prose alone", () => {
    expect(extractThoughtBody("Families keep a shared calendar for a reason.")).toBe(
      "Families keep a shared calendar for a reason.",
    );
  });

  it("extracts the body from a dumped record_thought XML call", () => {
    const body = extractThoughtBody(xmlDump);
    expect(body).toContain("Concrete mechanism:");
    expect(body).toContain("orphan pathway");
    expect(body).not.toContain("tool_call");
    expect(body).not.toContain("arg_key");
    expect(body).not.toContain("record_thought");
  });

  it("trims a cutoff dumped call to the last complete sentence", () => {
    const body = extractThoughtBody(xmlDump);
    expect(body.endsWith("theة")).toBe(false);
    expect(body).toMatch(/[.!?…]$/);
  });

  it("extracts a truncated question dump without a closing tag", () => {
    const dump = `<tool_call>record_thought<arg_key>body</arg_key><arg_value>What does "capital control" actually look like in cannabis beyond basic banking access`;
    expect(extractThoughtBody(dump)).toBe(
      'What does "capital control" actually look like in cannabis beyond basic banking access',
    );
  });
});

describe("thoughtFromModelStep", () => {
  it("prefers a recorded thought body after cleaning", () => {
    const thought = thoughtFromModelStep(
      { body: "A clean observation.", distanceToCore: 0.2, parentId: null },
      xmlDump,
    );
    expect(thought).toEqual({
      body: "A clean observation.",
      distanceToCore: 0.2,
      parentId: null,
    });
  });

  it("falls back to a cleaned model text dump when the tool was not called", () => {
    const thought = thoughtFromModelStep(undefined, xmlDump);
    expect(thought.body).toContain("Concrete mechanism:");
    expect(thought.body).not.toContain("<tool_call>");
    expect(thought.distanceToCore).toBe(0);
    expect(thought.parentId).toBeNull();
  });

  it("returns an empty body when the model produced no thought", () => {
    expect(thoughtFromModelStep(undefined, "").body).toBe("");
  });
});

describe("presentThoughtBody", () => {
  it("never returns dumped tool markup", () => {
    expect(presentThoughtBody(xmlDump)).not.toContain("tool_call");
    expect(presentThoughtBody(xmlDump)).not.toContain("arg_key");
  });
});

describe("isVisibleThoughtBody", () => {
  it("hides the examining-the-core placeholder", () => {
    expect(isVisibleThoughtBody("Continue examining the core.")).toBe(false);
    expect(isVisibleThoughtBody("continue examining the core")).toBe(false);
  });

  it("keeps a real observation, including one recovered from a tool dump", () => {
    expect(isVisibleThoughtBody("Banks set the pace.")).toBe(true);
    expect(
      isVisibleThoughtBody(
        `<tool_call>record_thought<arg_key>body</arg_key><arg_value>What does "capital control" actually look like in cannabis beyond basic banking access`,
      ),
    ).toBe(true);
  });
});
