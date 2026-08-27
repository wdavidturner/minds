import { Think, type TurnContext } from "@cloudflare/think";
import { callable, type RetryOptions } from "agents";
import { generateText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import type { CreateMindInput } from "../directory/index-logic";
import { DEFAULTS, DEFAULT_TEMPERAMENT } from "../defaults";
import type { Env } from "../env";
import { buildGraphPayload, type AgendaItemRow, type IdentityRow, type LineageRow, type SessionRow, type ThoughtRow } from "./graph";
import { MIND_DDL, MIND_FLAGS_DDL } from "./schema";
import { SqlStore } from "./sql-store";
import { runSession, type ModelStep, type ThoughtRecord } from "./session-loop";
import { activeLineageOrFallback, type VerbLineage } from "./verbs";
import type { BriefType, Outcome } from "../types";

const outcomes = [
  "continue_line",
  "expand",
  "conclude",
  "park",
  "noop",
  "connected",
  "unrelated",
  "dig",
  "select_suggestion",
  "ignore_inbox",
] as const;

class HumanTurnHandled extends Error {}

function statement(sql: (strings: TemplateStringsArray) => unknown, query: string): void {
  const strings = Object.assign([query], { raw: [query] }) as unknown as TemplateStringsArray;
  sql(strings);
}

export class Mind extends Think<Env> {
  private ponderPromise: Promise<void> | undefined;

  getModel() {
    if (!this.env.MODEL) throw new Error("MODEL is required");
    return createWorkersAI({ binding: this.env.AI })(this.env.MODEL);
  }

  getSystemPrompt(): string {
    return "You are a Mind. You explore the core you were given through deliberate, concise thoughts.";
  }

  onStart(): void {
    for (const ddl of MIND_DDL.split(";").map((item) => item.trim()).filter(Boolean)) {
      statement(this.sql.bind(this), `${ddl};`);
    }
    statement(this.sql.bind(this), MIND_FLAGS_DDL);
    const hasAbortGeneration = this.sql<{ name: string }>`PRAGMA table_info(flags)`
      .some((column) => column.name === "abort_generation");
    if (!hasAbortGeneration) {
      statement(this.sql.bind(this), "ALTER TABLE flags ADD COLUMN abort_generation INTEGER NOT NULL DEFAULT 0");
    }
  }

  @callable()
  async bootstrap(input: CreateMindInput): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.sql<{ slug: string }>`SELECT slug FROM identity LIMIT 1`[0]) {
      return { ok: false, error: "Mind is already bootstrapped" };
    }

    const now = Date.now();
    this.sql`
      INSERT INTO identity (slug, name, persona, core, temperament_json, paused, created_at)
      VALUES (
        ${input.slug}, ${input.name}, ${input.persona}, ${input.core},
        ${JSON.stringify(DEFAULT_TEMPERAMENT)}, 0, ${now}
      )
    `;
    this.sql`
      INSERT INTO lineages (
        id, kind, suggestion_id, status, stashed_from_lineage_id, dig_sessions, created_at, closed_at
      ) VALUES (${crypto.randomUUID()}, 'core', NULL, 'exploring', NULL, 0, ${now}, NULL)
    `;
    this.sql`INSERT INTO flags (force_pending, talk_pending) VALUES (0, 0)`;
    await this.schedule(DEFAULTS.hotSleepSeconds, "runPonder", {});
    return { ok: true };
  }

  queue<T = unknown>(
    callback: keyof this,
    payload: T,
    options?: { retry?: RetryOptions },
  ): Promise<string>;
  queue(text: string): Promise<{ id: string }>;
  @callable()
  async queue<T = unknown>(
    callbackOrText: (keyof this) | string,
    payload?: T,
    options?: { retry?: RetryOptions },
  ): Promise<string | { id: string }> {
    if (typeof callbackOrText !== "string" || arguments.length > 1) {
      return super.queue(callbackOrText as keyof this, payload, options);
    }

    const id = crypto.randomUUID();
    this.sql`
      INSERT INTO suggestions (id, text, status, created_at, lineage_id)
      VALUES (${id}, ${callbackOrText}, 'queued', ${Date.now()}, NULL)
    `;
    return { id };
  }

  @callable()
  async force(text: string): Promise<void> {
    this.abortGeneration();
    const suggestionId = crypto.randomUUID();
    const lineageId = crypto.randomUUID();
    const activeLineageId = new SqlStore(this.sql.bind(this)).activeLineageId();
    const now = Date.now();
    this.sql`
      INSERT INTO suggestions (id, text, status, created_at, lineage_id)
      VALUES (${suggestionId}, ${text}, 'selected', ${now}, ${lineageId})
    `;
    this.sql`
      INSERT INTO lineages (
        id, kind, suggestion_id, status, stashed_from_lineage_id, dig_sessions, created_at, closed_at
      ) VALUES (${lineageId}, 'suggestion', ${suggestionId}, 'relating', ${activeLineageId}, 0, ${now}, NULL)
    `;
    this.sql`UPDATE flags SET force_pending = 1`;
    if (this.ponderPromise) await this.ponderPromise;
    await this.runPonder();
  }

  @callable()
  async talk(text: string): Promise<void> {
    const target = activeLineageOrFallback(this.lineagesForTalk());
    this.sql`
      INSERT INTO utterances (id, lineage_id, text, created_at, consumed_at)
      VALUES (${crypto.randomUUID()}, ${target.id}, ${text}, ${Date.now()}, NULL)
    `;
    this.sql`UPDATE flags SET talk_pending = 1`;
    this.abortGeneration();
    if (this.ponderPromise) await this.ponderPromise;
    await this.runPonder();
  }

  @callable()
  async pause(): Promise<void> {
    this.sql`UPDATE identity SET paused = 1`;
  }

  @callable()
  async resume(): Promise<void> {
    this.sql`UPDATE identity SET paused = 0`;
    await this.schedule(DEFAULTS.hotSleepSeconds, "runPonder", {});
  }

  @callable()
  async runPonder(): Promise<void> {
    if (this.sql<{ paused: number }>`SELECT paused FROM identity LIMIT 1`[0]?.paused === 1) {
      return;
    }
    if (this.ponderPromise) return this.ponderPromise;

    const ponder = this.runPonderSession();
    this.ponderPromise = ponder;
    try {
      await ponder;
    } finally {
      if (this.ponderPromise === ponder) this.ponderPromise = undefined;
    }
  }

  private async runPonderSession(): Promise<void> {
    const store = new SqlStore(this.sql.bind(this));
    store.clearAbort();
    await runSession(store, this.modelStep(store), Date.now);
    await this.workspace.writeFile("public/graph.json", JSON.stringify(this.graphPayload()));
    await this.schedule(store.wakeSeconds, "runPonder", {});
  }

  async beforeTurn(ctx: TurnContext): Promise<void> {
    if (ctx.continuation) return;
    const text = this.latestUserText(ctx.messages);
    if (!text) return;
    await this.talk(text);
    throw new HumanTurnHandled();
  }

  onChatError(error: unknown): unknown {
    if (error instanceof HumanTurnHandled) return;
    return error;
  }

  getTools() {
    return {
      record_thought: tool({
        description: "Record one concise thought for the current pondering step.",
        inputSchema: z.object({
          body: z.string(),
          distanceToCore: z.number(),
          parentId: z.string().nullable().optional(),
        }),
        execute: async (input) => input,
      }),
      set_outcome: tool({
        description: "Set a legal outcome for the current pondering step.",
        inputSchema: z.object({
          outcome: z.enum(outcomes),
          agendaTexts: z.array(z.string()).optional(),
          suggestionId: z.string().optional(),
          endSession: z.boolean().optional(),
        }),
        execute: async (input) => input,
      }),
      fetch_url: tool({
        description: "Fetch a URL and return up to 20,000 characters of text.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => {
          try {
            const response = await fetch(url);
            if (!response.ok) return { error: `Request failed: ${response.status}` };
            return { text: (await response.text()).slice(0, 20_000) };
          } catch (error) {
            return { error: String(error) };
          }
        },
      }),
      publish_note: tool({
        description: "Publish a Markdown note to the Mind workspace.",
        inputSchema: z.object({ id: z.string(), markdown: z.string() }),
        execute: async ({ id, markdown }) => {
          await this.workspace.writeFile(`public/notes/${id}.md`, markdown);
          return { ok: true };
        },
      }),
    };
  }

  private modelStep(store: SqlStore): ModelStep {
    return async ({ brief, legal, recent, thoughtCount, elapsedMs, remainingMs, windDown }) => {
      let thought: ThoughtRecord | undefined;
      let outcome: Outcome | undefined;
      let agendaTexts: string[] | undefined;
      let suggestionId: string | undefined;
      let endSession = false;
      const tools = this.getTools();

      const result = await generateText({
        model: this.getModel(),
        system: this.ponderPrompt(brief, legal, elapsedMs, remainingMs, windDown, store),
        prompt: `Recent thought: ${recent || "(none)"}\nThoughts this session: ${thoughtCount}`,
        tools: {
          ...tools,
          record_thought: tool({
            description: tools.record_thought.description,
            inputSchema: z.object({
              body: z.string(),
              distanceToCore: z.number(),
              parentId: z.string().nullable().optional(),
            }),
            execute: async (input) => {
              thought = { ...input, parentId: input.parentId ?? null };
              return { ok: true };
            },
          }),
          set_outcome: tool({
            description: tools.set_outcome.description,
            inputSchema: z.object({
              outcome: z.enum(outcomes),
              agendaTexts: z.array(z.string()).optional(),
              suggestionId: z.string().optional(),
              endSession: z.boolean().optional(),
            }),
            execute: async (input) => {
              outcome = input.outcome;
              agendaTexts = input.agendaTexts;
              suggestionId = input.suggestionId;
              endSession = input.endSession ?? false;
              return { ok: true };
            },
          }),
        },
        maxOutputTokens: 500,
      });

      return {
        thought: thought ?? { body: result.text || "Continue examining the core.", distanceToCore: 0, parentId: null },
        outcome,
        agendaTexts,
        suggestionId,
        endSession,
      };
    };
  }

  private ponderPrompt(
    brief: BriefType,
    legal: readonly Outcome[],
    elapsedMs: number,
    remainingMs: number,
    windDown: boolean,
    store: SqlStore,
  ): string {
    const identity = this.sql<IdentityRow>`SELECT * FROM identity LIMIT 1`[0];
    if (!identity) throw new Error("Mind must be bootstrapped before pondering");
    return [
      `Persona:\n${identity.persona}`,
      `Core:\n${identity.core}`,
      `Brief: ${brief}`,
      `Legal outcomes: ${legal.join(", ")}`,
      `Elapsed milliseconds: ${elapsedMs}`,
      `Remaining milliseconds: ${remainingMs}`,
      `Wind down: ${windDown}`,
      "Use record_thought once. Use set_outcome only with a legal outcome when ready.",
    ].join("\n\n");
  }

  private graphPayload() {
    return buildGraphPayload(
      this.sql<IdentityRow>`SELECT * FROM identity`,
      this.sql<LineageRow>`SELECT * FROM lineages ORDER BY created_at`,
      this.sql<SessionRow>`SELECT * FROM sessions ORDER BY started_at`,
      this.sql<ThoughtRow>`SELECT * FROM thoughts ORDER BY created_at`,
      this.sql<AgendaItemRow>`SELECT * FROM agenda_items`,
    );
  }

  private abortGeneration(): void {
    this.sql`UPDATE flags SET abort_generation = 1`;
  }

  private lineagesForTalk(): VerbLineage[] {
    const activeLineageId = new SqlStore(this.sql.bind(this)).activeLineageId();
    return this.sql<VerbLineage & { created_at: number }>`
      SELECT id, kind, status, created_at, created_at AS createdAt
      FROM lineages
    `.map((lineage) => ({
      id: lineage.id,
      kind: lineage.kind,
      status: lineage.status,
      createdAt: lineage.created_at,
      active: lineage.id === activeLineageId,
    }));
  }

  private latestUserText(messages: unknown): string | undefined {
    if (!Array.isArray(messages)) return;
    for (const message of [...messages].reverse()) {
      if (!message || typeof message !== "object" || (message as { role?: unknown }).role !== "user") continue;
      const content = (message as { content?: unknown }).content;
      if (typeof content === "string") return content;
      if (!Array.isArray(content)) continue;
      const text = content
        .filter((part): part is { type: "text"; text: string } =>
          !!part && typeof part === "object" && (part as { type?: unknown }).type === "text"
            && typeof (part as { text?: unknown }).text === "string")
        .map((part) => part.text)
        .join("");
      if (text) return text;
    }
    return;
  }
}
