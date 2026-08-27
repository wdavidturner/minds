import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../src/defaults";
import { SqlStore } from "../src/mind/sql-store";

describe("SqlStore.recordThought", () => {
  it("stops writes and persists the full marker before returning", async () => {
    let updatedSession = false;
    let queries = 0;
    let markerPersisted = false;
    const sql = ((strings: TemplateStringsArray) => {
      queries++;
      const query = strings.join("");
      if (query.includes("SELECT lineage_id")) return [{ lineage_id: "lineage-1" }];
      if (query.includes("INSERT INTO thoughts")) throw new Error("SQLITE_FULL: database or disk is full");
      if (query.includes("UPDATE sessions")) updatedSession = true;
      return [];
    }) as never;
    const store = new SqlStore(sql, () =>
      new Promise((resolve) => {
        setTimeout(() => {
          markerPersisted = true;
          resolve();
        }, 0);
      }),
    );

    await store.recordThought("session-1", {
      body: "A thought that cannot be saved.",
      distanceToCore: 0,
      parentId: null,
    });

    expect(store.isWriteStopped()).toBe(true);
    expect(store.wakeSeconds).toBe(DEFAULTS.idleSleepSeconds * 10);
    expect(updatedSession).toBe(false);
    expect(markerPersisted).toBe(true);
    const queriesAfterFull = queries;

    await expect(
      store.recordThought("session-1", {
        body: "A second thought must not reach storage.",
        distanceToCore: 0,
        parentId: null,
      }),
    ).rejects.toThrow("Writes are stopped");
    expect(queries).toBe(queriesAfterFull);
  });
});
