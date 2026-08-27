import { describe, expect, it } from "vitest";
import { workerDashboardUrl, workerObservabilityUrl } from "../src/cloudflare-links";

describe("cloudflare-links", () => {
  it("points at this Worker in the dashboard", () => {
    expect(workerDashboardUrl()).toBe(
      "https://dash.cloudflare.com/?to=/:account/workers/services/view/minds",
    );
  });

  it("points at this Worker's observability traces", () => {
    expect(workerObservabilityUrl("family-hub-one")).toContain(
      "https://dash.cloudflare.com/?to=/:account/workers/services/view/minds/production/observability",
    );
    expect(workerObservabilityUrl("family-hub-one")).toContain("family-hub-one");
  });
});
