import { DatabaseSync } from "node:sqlite";
import { MIND_DDL, MIND_FLAGS_DDL } from "../../src/mind/schema";

type Row = Record<string, string | number | boolean | null>;

/**
 * A real in-memory SQLite database (Node's built-in `node:sqlite`, not
 * miniflare/vitest-pool-workers) wired to the same tagged-template `Sql`
 * shape `SqlStore` expects from `this.sql` in the Durable Object. This lets
 * the store tests exercise real SQL (joins, rowid ordering, CHECK
 * constraints) instead of a hand-rolled query-string-matching fake.
 */
export function createMindDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(MIND_DDL);
  db.exec(MIND_FLAGS_DDL);

  function sql<T = Row>(
    strings: TemplateStringsArray,
    ...values: (string | number | boolean | null)[]
  ): T[] {
    const text = strings.reduce(
      (acc, part, i) => acc + part + (i < values.length ? "?" : ""),
      "",
    );
    const params = values.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value));
    const trimmed = text.trim().toUpperCase();
    const stmt = db.prepare(text);
    if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) {
      return stmt.all(...params) as T[];
    }
    stmt.run(...params);
    return [] as T[];
  }

  function seedIdentity(overrides: Partial<{ slug: string; paused: number }> = {}) {
    const now = Date.now();
    sql`
      INSERT INTO identity (slug, name, persona, core, temperament_json, paused, created_at)
      VALUES (${overrides.slug ?? "ada"}, 'Ada', 'A careful observer.', 'A thoughtful core.', '{}', ${overrides.paused ?? 0}, ${now})
    `;
  }

  function seedCoreLineage(id = "core-1"): string {
    sql`
      INSERT INTO lineages (id, kind, suggestion_id, status, stashed_from_lineage_id, dig_sessions, created_at, closed_at)
      VALUES (${id}, 'core', NULL, 'exploring', NULL, 0, ${Date.now()}, NULL)
    `;
    return id;
  }

  function seedFlags() {
    sql`INSERT INTO flags (force_pending, talk_pending) VALUES (0, 0)`;
  }

  function seedSuggestion(id: string, text: string, status: "queued" | "selected" | "dismissed" = "queued") {
    sql`
      INSERT INTO suggestions (id, text, status, created_at, lineage_id)
      VALUES (${id}, ${text}, ${status}, ${Date.now()}, NULL)
    `;
  }

  function seedRelatingLineage(id: string, suggestionId: string, stashedFrom: string | null) {
    sql`
      INSERT INTO lineages (id, kind, suggestion_id, status, stashed_from_lineage_id, dig_sessions, created_at, closed_at)
      VALUES (${id}, 'suggestion', ${suggestionId}, 'relating', ${stashedFrom}, 0, ${Date.now()}, NULL)
    `;
    sql`UPDATE suggestions SET status = 'selected', lineage_id = ${id} WHERE id = ${suggestionId}`;
  }

  function bootstrap() {
    seedIdentity();
    seedCoreLineage();
    seedFlags();
  }

  return { db, sql, seedIdentity, seedCoreLineage, seedFlags, seedSuggestion, seedRelatingLineage, bootstrap };
}
