import { Think } from "@cloudflare/think";
import { getAgentByName } from "agents";
import { tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import type { Env } from "../env";
import { coreSummary, validateCreate } from "./index-logic";
import { DEFAULT_TEMPERAMENT_JSON, DIRECTORY_DDL } from "./schema";

function statement(sql: (strings: TemplateStringsArray) => unknown, query: string): void {
  const strings = Object.assign([query], { raw: [query] }) as unknown as TemplateStringsArray;
  sql(strings);
}

export class Directory extends Think<Env> {
  getModel() {
    if (!this.env.MODEL) throw new Error("MODEL is required");
    return createWorkersAI({ binding: this.env.AI })(this.env.MODEL);
  }

  getSystemPrompt(): string {
    return "You are the Directory; you create and list Minds; you do not ponder topics.";
  }

  onStart(): void {
    statement(this.sql.bind(this), DIRECTORY_DDL);
  }

  getTools() {
    return {
      create_mind: tool({
        description: "Create a new Mind.",
        inputSchema: z.object({
          slug: z.string(),
          name: z.string(),
          persona: z.string(),
          core: z.string(),
        }),
        execute: async (input) => {
          const existingSlugs = this.sql<{ slug: string }>`SELECT slug FROM minds`.map(
            (row) => row.slug,
          );
          const validation = validateCreate(input, existingSlugs);
          if (!validation.ok) return validation;

          const now = Date.now();
          this.sql`
            INSERT INTO minds (slug, name, core_summary, temperament_json, status, created_at, archived_at)
            VALUES (
              ${input.slug}, ${input.name}, ${coreSummary(input.core)},
              ${DEFAULT_TEMPERAMENT_JSON}, 'booting', ${now}, NULL
            )
          `;
          try {
            const bootstrapped = await (
              await getAgentByName(this.env.Mind, input.slug)
            ).bootstrap(input);
            if (!bootstrapped.ok) return bootstrapped;
            this.sql`UPDATE minds SET status = 'live' WHERE slug = ${input.slug}`;
            return { ok: true };
          } catch (error) {
            return { ok: false, error: String(error) };
          }
        },
      }),
      list_minds: tool({
        description: "List all non-archived Minds.",
        inputSchema: z.object({}),
        execute: async () =>
          this.sql`
            SELECT slug, name, core_summary, temperament_json, status, created_at, archived_at
            FROM minds WHERE status != 'archived' ORDER BY created_at
          `,
      }),
      archive_mind: tool({
        description: "Archive a Mind in the directory.",
        inputSchema: z.object({ slug: z.string() }),
        execute: async ({ slug }) => {
          this.sql`
            UPDATE minds SET status = 'archived', archived_at = ${Date.now()}
            WHERE slug = ${slug}
          `;
          return { ok: true };
        },
      }),
      describe_mind: tool({
        description: "Describe a Mind in the directory.",
        inputSchema: z.object({ slug: z.string() }),
        execute: async ({ slug }) =>
          this.sql`
            SELECT slug, name, core_summary, temperament_json, status, created_at, archived_at
            FROM minds WHERE slug = ${slug}
          `,
      }),
      set_temperament: tool({
        description: "Set a Mind's temperament in the directory.",
        inputSchema: z.object({
          slug: z.string(),
          temperament: z.object({
            branching: z.number(),
            persistence: z.number(),
            curiosity: z.number(),
            distance: z.number(),
          }),
        }),
        execute: async ({ slug, temperament }) => {
          this.sql`
            UPDATE minds SET temperament_json = ${JSON.stringify(temperament)}
            WHERE slug = ${slug}
          `;
          return { ok: true };
        },
      }),
    };
  }
}
