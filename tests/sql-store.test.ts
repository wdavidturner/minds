import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../src/defaults";
import { SqlStore } from "../src/mind/sql-store";

describe("SqlStore.recordThought", () => {
  it("stops writes and schedules a long wake when storage is full", () => {
    let updatedSession = false;
    let queries = 0;
    const sql = ((strings: TemplateStringsArray) => {
      queries++;
      const query = strings.join("");
      if (query.includes("SELECT lineage_id")) return [{ lineage_id: "lineage-1" }];
      if (query.includes("INSERT INTO thoughts")) throw new Error("SQLITE_FULL: database or disk is full");
      if (query.includes("UPDATE sessions")) updatedSession = true;
      return [];
    }) as never;
    const store = new SqlStore(sql);

    store.recordThought("session-1", {
      body: "A thought that cannot be saved.",
      distanceToCore: 0,
      parentId: null,
    });

    expect(store.isWriteStopped()).toBe(true);
    expect(store.wakeSeconds).toBe(DEFAULTS.idleSleepSeconds * 10);
    expect(updatedSession).toBe(false);
    const queriesAfterFull = queries;

    expect(() =>
      store.recordThought("session-1", {
        body: "A second thought must not reach storage.",
        distanceToCore: 0,
        parentId: null,
      }),
    ).toThrow("Writes are stopped");
    expect(queries).toBe(queriesAfterFull);
  });
});
