import type { ApplyResult } from "./apply-outcome";
import { decideBrief } from "./brief";
import type { SessionStore, ThoughtRecord } from "./session-loop";
import { DEFAULTS } from "../defaults";
import type { BriefType, LineageKind, LineageStatus, MindSnapshot } from "../types";

type Sql = <T = Record<string, string | number | boolean | null>>(
  strings: TemplateStringsArray,
  ...values: (string | number | boolean | null)[]
) => T[];

type Lineage = {
  id: string;
  kind: LineageKind;
  status: LineageStatus;
  dig_sessions: number;
};

function id(): string {
  return crypto.randomUUID();
}

function isSqliteFull(error: unknown): boolean {
  return String(error).includes("SQLITE_FULL");
}

export class SqlStore implements SessionStore {
  wakeSeconds = 0;
  private writeStopped = false;

  constructor(
    private readonly sql: Sql,
    private readonly onWriteStopped?: () => Promise<void>,
  ) {}

  private ensureWritable(): void {
    if (this.writeStopped) throw new Error("Writes are stopped after SQLITE_FULL");
  }

  snapshot(): MindSnapshot {
    const identity = this.sql<{ paused: number }>`SELECT paused FROM identity LIMIT 1`[0];
    const activeLineage = this.sql<Lineage>`
      SELECT id, kind, status, dig_sessions
      FROM lineages
      WHERE status IN ('relating', 'exploring')
      ORDER BY created_at DESC
      LIMIT 1
    `[0];
    const [agenda, relating, open, queued, flags] = [
      // 'active' agenda items are still open work; counting only 'pending' let a
      // session that marked its item 'active' fall out of pursue_agenda early.
      this.sql<{ count: number }>`
        SELECT COUNT(*) AS count FROM agenda_items WHERE status IN ('pending', 'active')
      `[0],
      this.sql<{ count: number }>`SELECT COUNT(*) AS count FROM lineages WHERE status = 'relating'`[0],
      this.sql<{ count: number }>`SELECT COUNT(*) AS count FROM lineages WHERE status IN ('relating', 'exploring')`[0],
      this.sql<{ count: number }>`SELECT COUNT(*) AS count FROM suggestions WHERE status = 'queued'`[0],
      this.sql<{ force_pending: number; talk_pending: number }>`
        SELECT force_pending, talk_pending FROM flags LIMIT 1
      `[0],
    ];

    return {
      paused: identity?.paused === 1,
      forcePending: flags?.force_pending === 1,
      talkPending: flags?.talk_pending === 1,
      agendaPendingCount: agenda?.count ?? 0,
      activeLineage: activeLineage
        ? {
            id: activeLineage.id,
            kind: activeLineage.kind,
            status: activeLineage.status,
            digSessions: activeLineage.dig_sessions,
          }
        : null,
      hasRelatingOpen: (relating?.count ?? 0) > 0,
      hasOpenBranch: (open?.count ?? 0) > 0,
      queuedCount: queued?.count ?? 0,
    };
  }

  startSession(brief: BriefType, lineageId: string | null): string {
    this.ensureWritable();
    const coreId = this.sql<{ id: string }>`
      SELECT id FROM lineages WHERE kind = 'core' LIMIT 1
    `[0]?.id;
    if (!coreId) throw new Error("Core lineage is required");

    if (brief === "pursue_agenda") this.beginActiveAgendaItem();

    const sessionId = id();
    const now = Date.now();
    this.sql`
      INSERT INTO sessions (id, brief_type, lineage_id, started_at, ended_at, outcome, thought_count)
      VALUES (${sessionId}, ${brief}, ${lineageId ?? coreId}, ${now}, ${now}, NULL, 0)
    `;
    return sessionId;
  }

  /**
   * Picks the item pursue_agenda will work this session: whichever is already
   * 'active' (resumed from a prior continue_line), else the oldest 'pending'
   * one, promoted to 'active'. Without this, agenda_items never move past
   * 'pending' and pursue_agenda starves every other brief forever.
   */
  private beginActiveAgendaItem(): void {
    const active = this.sql<{ id: string }>`SELECT id FROM agenda_items WHERE status = 'active' LIMIT 1`[0];
    if (active) return;
    const nextPending = this.sql<{ id: string }>`
      SELECT id FROM agenda_items WHERE status = 'pending' ORDER BY rowid LIMIT 1
    `[0];
    if (nextPending) {
      this.sql`UPDATE agenda_items SET status = 'active' WHERE id = ${nextPending.id}`;
    }
  }

  async recordThought(sessionId: string, thought: ThoughtRecord): Promise<string> {
    this.ensureWritable();
    const session = this.sql<{ lineage_id: string }>`
      SELECT lineage_id FROM sessions WHERE id = ${sessionId}
    `[0];
    if (!session) throw new Error("Session is required");

    const lineage = this.sql<{ suggestion_id: string | null }>`
      SELECT suggestion_id FROM lineages WHERE id = ${session.lineage_id}
    `[0];

    const thoughtId = id();
    try {
      this.sql`
        INSERT INTO thoughts (
          id, session_id, lineage_id, suggestion_id, parent_id, body, distance_to_core, created_at
        ) VALUES (
          ${thoughtId}, ${sessionId}, ${session.lineage_id}, ${lineage?.suggestion_id ?? null}, ${thought.parentId},
          ${thought.body}, ${thought.distanceToCore}, ${Date.now()}
        )
      `;
      this.sql`
        UPDATE sessions
        SET thought_count = thought_count + 1, ended_at = ${Date.now()}
        WHERE id = ${sessionId}
      `;
    } catch (error) {
      if (!isSqliteFull(error)) throw error;
      this.writeStopped = true;
      this.setWake(DEFAULTS.idleSleepSeconds * 10);
      await this.onWriteStopped?.();
    }
    return thoughtId;
  }

  apply(result: ApplyResult, sessionId: string): void {
    this.ensureWritable();
    const now = Date.now();
    if (result.lineage) {
      if (result.lineage.status) {
        this.sql`UPDATE lineages SET status = ${result.lineage.status} WHERE id = ${result.lineage.id}`;
      }
      if (result.lineage.digSessions) {
        this.sql`
          UPDATE lineages
          SET dig_sessions = dig_sessions + ${result.lineage.digSessions}
          WHERE id = ${result.lineage.id}
        `;
      }
      if (result.lineage.closed) {
        this.sql`UPDATE lineages SET closed_at = ${now} WHERE id = ${result.lineage.id}`;
      }
      if (result.lineage.restoreStash) {
        this.sql`
          UPDATE lineages
          SET status = 'exploring'
          WHERE id = (
            SELECT stashed_from_lineage_id FROM lineages WHERE id = ${result.lineage.id}
          )
        `;
      }
    }

    // conclude/park inside pursue_agenda close the agenda item, not the lineage.
    if (result.agendaItemDone) {
      this.sql`UPDATE agenda_items SET status = 'done' WHERE status = 'active'`;
    }

    for (const text of result.agendaTexts ?? []) {
      const thoughtId = this.sql<{ id: string }>`
        SELECT id FROM thoughts WHERE session_id = ${sessionId} ORDER BY created_at DESC LIMIT 1
      `[0]?.id;
      if (!thoughtId) continue;
      const lineageId = this.sql<{ lineage_id: string }>`
        SELECT lineage_id FROM sessions WHERE id = ${sessionId}
      `[0]?.lineage_id;
      if (!lineageId) continue;
      this.sql`
        INSERT INTO agenda_items (id, lineage_id, origin_session_id, origin_thought_id, text, status)
        VALUES (${id()}, ${lineageId}, ${sessionId}, ${thoughtId}, ${text}, 'pending')
      `;
    }

    if (result.clearForce) this.sql`UPDATE flags SET force_pending = 0`;
    if (result.clearTalk) this.sql`UPDATE flags SET talk_pending = 0`;
    if (result.dismissSuggestion) {
      this.sql`
        UPDATE suggestions SET status = 'dismissed'
        WHERE id = (SELECT suggestion_id FROM lineages WHERE id = (
          SELECT lineage_id FROM sessions WHERE id = ${sessionId}
        ))
      `;
    }

    // Only the outcome that actually ends the session may set sessions.outcome.
    // select_suggestion/ignore_inbox apply mid-session (brief changes, loop
    // continues) and must not latch a placeholder outcome that a later
    // conclude/park/continue_line can never overwrite.
    if (result.outcome) {
      this.sql`
        UPDATE sessions SET outcome = ${result.outcome}, ended_at = ${now}
        WHERE id = ${sessionId}
      `;
    }
  }

  setWake(seconds: number): void {
    this.wakeSeconds = seconds;
  }

  isWriteStopped(): boolean {
    return this.writeStopped;
  }

  recentLine(lineageId: string | null): string {
    if (!lineageId) return "";
    return this.sql<{ body: string }>`
      SELECT body FROM thoughts WHERE lineage_id = ${lineageId}
      ORDER BY created_at DESC LIMIT 1
    `[0]?.body ?? "";
  }

  legalUnderlyingBrief(): BriefType | undefined {
    const snapshot = this.snapshot();
    return decideBrief({
      ...snapshot,
      forcePending: false,
      talkPending: false,
      agendaPendingCount: 0,
    });
  }

  activeLineageId(): string | null {
    return this.snapshot().activeLineage?.id ?? null;
  }

  createLineageFromSuggestion(suggestionId: string, sessionId: string): string {
    this.ensureWritable();
    const lineageId = id();
    this.sql`
      INSERT INTO lineages (
        id, kind, suggestion_id, status, stashed_from_lineage_id, dig_sessions, created_at, closed_at
      ) VALUES (${lineageId}, 'suggestion', ${suggestionId}, 'relating', NULL, 0, ${Date.now()}, NULL)
    `;
    this.sql`UPDATE suggestions SET status = 'selected', lineage_id = ${lineageId} WHERE id = ${suggestionId}`;
    // Thoughts attach via sessions.lineage_id; without this, thoughts recorded
    // after select_suggestion still tag the session's original (core) lineage.
    this.sql`UPDATE sessions SET lineage_id = ${lineageId} WHERE id = ${sessionId}`;
    return lineageId;
  }

  pickQueuedSuggestionId(): string | null {
    return this.sql<{ id: string }>`
      SELECT id FROM suggestions WHERE status = 'queued' ORDER BY created_at LIMIT 1
    `[0]?.id ?? null;
  }

  isAborted(): boolean {
    return this.sql<{ abort_generation: number }>`
      SELECT abort_generation FROM flags LIMIT 1
    `[0]?.abort_generation === 1;
  }

  clearAbort(): void {
    this.ensureWritable();
    this.sql`UPDATE flags SET abort_generation = 0`;
  }

  // --- Prompt/tool text context (operator input the model must see) ---

  queuedSuggestions(): { id: string; text: string }[] {
    return this.sql<{ id: string; text: string }>`
      SELECT id, text FROM suggestions WHERE status = 'queued' ORDER BY created_at
    `;
  }

  /** The suggestion text behind the active relating/dig probe, if any. */
  activeProbeText(): string | undefined {
    const activeId = this.activeLineageId();
    if (!activeId) return undefined;
    return this.sql<{ text: string }>`
      SELECT s.text AS text
      FROM lineages l
      JOIN suggestions s ON s.id = l.suggestion_id
      WHERE l.id = ${activeId}
    `[0]?.text;
  }

  /** Unconsumed talk utterances, marked consumed so they surface exactly once. */
  consumeTalkTexts(): string[] {
    const rows = this.sql<{ id: string; text: string }>`
      SELECT id, text FROM utterances WHERE consumed_at IS NULL ORDER BY created_at
    `;
    if (rows.length === 0 || this.writeStopped) return rows.map((row) => row.text);
    const now = Date.now();
    for (const row of rows) {
      try {
        this.sql`UPDATE utterances SET consumed_at = ${now} WHERE id = ${row.id}`;
      } catch {
        break;
      }
    }
    return rows.map((row) => row.text);
  }

  activeAgendaItemText(): string | undefined {
    return this.sql<{ text: string }>`SELECT text FROM agenda_items WHERE status = 'active' LIMIT 1`[0]?.text;
  }
}
