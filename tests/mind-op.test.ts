import { describe, expect, it } from "vitest";
import { workerDashboardUrl, workerObservabilityUrl } from "../src/cloudflare-links";
import { mindOperator, type OperatorView } from "../src/html/mind-op";

function view(overrides: Partial<OperatorView> = {}): OperatorView {
  return {
    paused: false,
    pondering: false,
    storageFull: false,
    nextBrief: "grow_frontier",
    queuedCount: 0,
    inbox: [],
    activeLineage: { kind: "core", status: "exploring" },
    lastSession: null,
    model: "@cf/zai-org/glm-4.7-flash",
    modelOverride: "",
    ...overrides,
  };
}

describe("mindOperator", () => {
  it("uses a compact chrome with back, public, pause, and model", () => {
    const html = mindOperator("family-hub-one", view());
    expect(html).toContain("Go back to directory");
    expect(html).toContain('href="/op/directory"');
    expect(html).toContain('class="btn" href="/minds/family-hub-one"');
    expect(html).toContain("Public page");
    expect(html).toContain('class="op-chrome"');
    expect(html).toContain(">Pause<");
    expect(html).not.toContain(">Resume<");
    expect(html).toContain('action="/op/minds/family-hub-one/model"');
    expect(html).toContain("onchange=");
    expect(html).toContain("@cf/zai-org/glm-5.3-flash");
  });

  it("links to the Cloudflare worker dashboard and observability traces", () => {
    const html = mindOperator("family-hub-one", view());
    expect(html).toContain(workerDashboardUrl());
    expect(html).toContain(workerObservabilityUrl("family-hub-one"));
    expect(html).toContain("Cloudflare dashboard");
    expect(html).toContain("Logs &amp; traces");
  });

  it("composes queue, force, and talk as tabs with a queue count", () => {
    const html = mindOperator(
      "family-hub-one",
      view({ queuedCount: 1, inbox: ["school pickup times"] }),
    );
    expect(html).toContain('class="compose-tabs"');
    expect(html).toContain("Queue");
    expect(html).toContain("Force");
    expect(html).toContain("Talk");
    expect(html).toContain("school pickup times");
    expect(html).toContain(">1<");
    expect(html).toContain('action="/op/minds/family-hub-one/queue"');
    expect(html).toContain('action="/op/minds/family-hub-one/force"');
    expect(html).toContain('action="/op/minds/family-hub-one/talk"');
  });

  it("shows waiting status before the first session", () => {
    const html = mindOperator("family-hub-one", view());
    expect(html).toContain("waiting for first session");
    expect(html).toContain("grow_frontier");
    expect(html).toContain("core — exploring");
  });

  it("shows resume instead of pause when the Mind is paused", () => {
    const html = mindOperator("family-hub-one", view({ paused: true }));
    expect(html).toContain("paused");
    expect(html).toContain(">Resume<");
    expect(html).not.toContain(">Pause<");
  });

  it("shows when a session is in flight", () => {
    const html = mindOperator(
      "family-hub-one",
      view({ pondering: true, nextBrief: "continue_line" }),
    );
    expect(html).toContain("in a session");
    expect(html).toContain("continue_line");
  });

  it("shows the last session", () => {
    const html = mindOperator(
      "family-hub-one",
      view({
        lastSession: {
          briefType: "grow_frontier",
          outcome: "continue_line",
          thoughtCount: 8,
        },
      }),
    );
    expect(html).toContain("hibernating until next wake");
    expect(html).toContain("grow_frontier → continue_line (8 thoughts)");
  });

  it("surfaces a storage-full alert", () => {
    const html = mindOperator("family-hub-one", view({ storageFull: true }));
    expect(html).toContain("Storage is full");
  });
});
