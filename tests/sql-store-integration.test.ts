import { describe, expect, it } from "vitest";
import { applyOutcome } from "../src/mind/apply-outcome";
import { decideBrief } from "../src/mind/brief";
import { SqlStore } from "../src/mind/sql-store";
import { createMindDb } from "./helpers/mind-db";

function thought(body: string) {
  return { body, distanceToCore: 0, parentId: null };
}

describe("SqlStore.legalUnderlyingBrief", () => {
  it("reflects the core lineage's open branch when nothing else is live", () => {
    const { sql, bootstrap } = createMindDb();
    bootstrap();
    const store = new SqlStore(sql);

    expect(store.legalUnderlyingBrief()).toBe("continue_line");
  });

  it("reflects relate when a relating lineage is open, not undefined", () => {
    const { sql, bootstrap, seedSuggestion, seedRelatingLineage } = createMindDb();
    bootstrap();
    seedSuggestion("sugg-1", "Is this related?");
    seedRelatingLineage("probe-1", "sugg-1", "core-1");
    const store = new SqlStore(sql);

    expect(store.legalUnderlyingBrief()).toBe("relate");
  });

  it("reflects dig when the relating lineage is mid-dig under the cap", () => {
    const { sql, bootstrap, seedSuggestion, seedRelatingLineage } = createMindDb();
    bootstrap();
    seedSuggestion("sugg-1", "Is this related?");
    seedRelatingLineage("probe-1", "sugg-1", "core-1");
    // Force a strictly later created_at so the "most recent open lineage"
    // query deterministically picks the probe over the core in this test.
    sql`UPDATE lineages SET dig_sessions = 1, created_at = created_at + 1000 WHERE id = 'probe-1'`;
    const store = new SqlStore(sql);

    expect(store.legalUnderlyingBrief()).toBe("dig");
  });
});

describe("SqlStore suggestion_id tagging", () => {
  it("tags thoughts with the lineage's suggestion_id when it belongs to a suggestion lineage", async () => {
    const { sql, bootstrap, seedSuggestion, seedRelatingLineage } = createMindDb();
    bootstrap();
    seedSuggestion("sugg-1", "Is this related?");
    seedRelatingLineage("probe-1", "sugg-1", "core-1");
    const store = new SqlStore(sql);

    const sessionId = store.startSession("relate", "probe-1");
    await store.recordThought(sessionId, thought("Considering the probe."));

    const [row] = sql<{ lineage_id: string; suggestion_id: string | null }>`
      SELECT lineage_id, suggestion_id FROM thoughts WHERE session_id = ${sessionId}
    `;
    expect(row.lineage_id).toBe("probe-1");
    expect(row.suggestion_id).toBe("sugg-1");
  });

  it("leaves suggestion_id null for thoughts on the core lineage", async () => {
    const { sql, bootstrap } = createMindDb();
    bootstrap();
    const store = new SqlStore(sql);

    const sessionId = store.startSession("continue_line", "core-1");
    await store.recordThought(sessionId, thought("On the core."));

    const [row] = sql<{ suggestion_id: string | null }>`
      SELECT suggestion_id FROM thoughts WHERE session_id = ${sessionId}
    `;
    expect(row.suggestion_id).toBeNull();
  });

  it("attaches subsequent thoughts to the new lineage after select_suggestion", async () => {
    const { sql, bootstrap, seedSuggestion } = createMindDb();
    bootstrap();
    seedSuggestion("sugg-1", "Queued idea.");
    const store = new SqlStore(sql);

    const sessionId = store.startSession("inbox_glance", null);
    await store.recordThought(sessionId, thought("Looking at the inbox."));
    const newLineageId = store.createLineageFromSuggestion("sugg-1", sessionId);
    await store.recordThought(sessionId, thought("Now on the selected probe."));

    const rows = sql<{ lineage_id: string; suggestion_id: string | null }>`
      SELECT lineage_id, suggestion_id FROM thoughts WHERE session_id = ${sessionId} ORDER BY created_at
    `;
    expect(rows[0].lineage_id).toBe("core-1");
    expect(rows[1].lineage_id).toBe(newLineageId);
    expect(rows[1].suggestion_id).toBe("sugg-1");

    const [session] = sql<{ lineage_id: string }>`SELECT lineage_id FROM sessions WHERE id = ${sessionId}`;
    expect(session.lineage_id).toBe(newLineageId);
  });
});

describe("SqlStore.apply outcome persistence", () => {
  it("does not latch continue_line on the mid-session select_suggestion apply", () => {
    const { sql, bootstrap, seedSuggestion } = createMindDb();
    bootstrap();
    seedSuggestion("sugg-1", "Queued idea.");
    const store = new SqlStore(sql);

    const sessionId = store.startSession("inbox_glance", null);
    store.apply(
      applyOutcome({ outcome: "select_suggestion", brief: "inbox_glance", activeLineageId: null }),
      sessionId,
    );

    const [midSession] = sql<{ outcome: string | null }>`SELECT outcome FROM sessions WHERE id = ${sessionId}`;
    expect(midSession.outcome).toBeNull();

    store.apply(
      applyOutcome({
        outcome: "conclude",
        brief: "relate",
        activeLineageId: "probe-1",
        activeLineageKind: "suggestion",
      }),
      sessionId,
    );

    const [finalSession] = sql<{ outcome: string | null }>`SELECT outcome FROM sessions WHERE id = ${sessionId}`;
    expect(finalSession.outcome).toBe("conclude");
  });

  it("persists the real final outcome, not always continue_line", () => {
    const { sql, bootstrap } = createMindDb();
    bootstrap();
    const store = new SqlStore(sql);
    const sessionId = store.startSession("continue_line", "core-1");

    store.apply(applyOutcome({ outcome: "expand", brief: "continue_line", activeLineageId: "core-1" }), sessionId);

    const [row] = sql<{ outcome: string | null }>`SELECT outcome FROM sessions WHERE id = ${sessionId}`;
    expect(row.outcome).toBe("expand");
  });
});

describe("SqlStore core-lineage guard", () => {
  it("does not close the core lineage on conclude", () => {
    const { sql, bootstrap } = createMindDb();
    bootstrap();
    const store = new SqlStore(sql);
    const sessionId = store.startSession("continue_line", "core-1");

    store.apply(
      applyOutcome({
        outcome: "conclude",
        brief: "continue_line",
        activeLineageId: "core-1",
        activeLineageKind: "core",
      }),
      sessionId,
    );

    const [core] = sql<{ status: string; closed_at: number | null }>`
      SELECT status, closed_at FROM lineages WHERE id = 'core-1'
    `;
    expect(core.status).toBe("exploring");
    expect(core.closed_at).toBeNull();
  });
});

describe("SqlStore agenda item status transitions", () => {
  it("marks the oldest pending item active on pursue_agenda, and done on conclude, without starving other briefs forever", () => {
    const { sql, bootstrap } = createMindDb();
    bootstrap();
    sql`
      INSERT INTO agenda_items (id, lineage_id, origin_session_id, origin_thought_id, text, status)
      VALUES ('agenda-1', 'core-1', 'origin-session', 'origin-thought', 'First item', 'pending')
    `;
    sql`
      INSERT INTO agenda_items (id, lineage_id, origin_session_id, origin_thought_id, text, status)
      VALUES ('agenda-2', 'core-1', 'origin-session', 'origin-thought', 'Second item', 'pending')
    `;
    const store = new SqlStore(sql);

    expect(store.snapshot().agendaPendingCount).toBe(2);
    expect(decideBrief(store.snapshot())).toBe("pursue_agenda");

    const session1 = store.startSession("pursue_agenda", null);
    expect(sql<{ status: string }>`SELECT status FROM agenda_items WHERE id = 'agenda-1'`[0].status).toBe("active");
    expect(sql<{ status: string }>`SELECT status FROM agenda_items WHERE id = 'agenda-2'`[0].status).toBe("pending");
    // Still counted (active + pending), so the brief keeps returning to this item.
    expect(store.snapshot().agendaPendingCount).toBe(2);

    store.apply(
      applyOutcome({ outcome: "conclude", brief: "pursue_agenda", activeLineageId: "core-1" }),
      session1,
    );
    expect(sql<{ status: string }>`SELECT status FROM agenda_items WHERE id = 'agenda-1'`[0].status).toBe("done");
    expect(store.snapshot().agendaPendingCount).toBe(1);
    // Concluding an agenda item must not close the lineage it lives on.
    expect(sql<{ status: string }>`SELECT status FROM lineages WHERE id = 'core-1'`[0].status).toBe("exploring");

    const session2 = store.startSession("pursue_agenda", null);
    expect(sql<{ status: string }>`SELECT status FROM agenda_items WHERE id = 'agenda-2'`[0].status).toBe("active");

    store.apply(
      applyOutcome({ outcome: "park", brief: "pursue_agenda", activeLineageId: "core-1" }),
      session2,
    );
    expect(sql<{ status: string }>`SELECT status FROM agenda_items WHERE id = 'agenda-2'`[0].status).toBe("done");

    // Both items resolved: pursue_agenda no longer starves the rest of the gate.
    expect(store.snapshot().agendaPendingCount).toBe(0);
    expect(decideBrief(store.snapshot())).not.toBe("pursue_agenda");
  });

  it("keeps continue_line on an agenda item active for next time (does not resolve it)", () => {
    const { sql, bootstrap } = createMindDb();
    bootstrap();
    sql`
      INSERT INTO agenda_items (id, lineage_id, origin_session_id, origin_thought_id, text, status)
      VALUES ('agenda-1', 'core-1', 'origin-session', 'origin-thought', 'First item', 'pending')
    `;
    const store = new SqlStore(sql);
    const sessionId = store.startSession("pursue_agenda", null);

    store.apply(
      applyOutcome({ outcome: "continue_line", brief: "pursue_agenda", activeLineageId: "core-1" }),
      sessionId,
    );

    expect(sql<{ status: string }>`SELECT status FROM agenda_items WHERE id = 'agenda-1'`[0].status).toBe("active");
    expect(store.snapshot().agendaPendingCount).toBe(1);
    // The same (still-active) item resumes next time, not a fresh pick.
    const session2 = store.startSession("pursue_agenda", null);
    expect(sql<{ status: string }>`SELECT status FROM agenda_items WHERE id = 'agenda-1'`[0].status).toBe("active");
    expect(session2).not.toBe(sessionId);
  });
});

describe("SqlStore thought publish hook", () => {
  it("calls onThought after a thought is recorded", async () => {
    const { sql, bootstrap } = createMindDb();
    bootstrap();
    const calls: number[] = [];
    const store = new SqlStore(sql, undefined, async () => {
      calls.push(1);
    });
    const sessionId = store.startSession("continue_line", "core-1");
    await store.recordThought(sessionId, thought("A live thought."));
    expect(calls).toHaveLength(1);
  });
});
