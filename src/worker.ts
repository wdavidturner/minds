import { getAgentByName, routeAgentRequest } from "agents";
import { isOperator, unauthorized } from "./auth";
import { directoryDashboard } from "./html/directory-dashboard";
import { gallery, type MindCard } from "./html/gallery";
import { login, loginPostResponse } from "./html/login";
import { mindOperator } from "./html/mind-op";
import { mindPublic } from "./html/mind-public";
import { newMindForm } from "./html/new-mind-form";
import { layout } from "./html/layout";
import type { Env } from "./env";
import { matchRoute } from "./routes";

export { matchRoute } from "./routes";

type TurnMessagePart = { type: string; text?: string };
type TurnResultLike = { message?: { parts?: TurnMessagePart[] } };

/**
 * `?token=` is only accepted on `/agents/*` (WebSocket upgrades cannot set a
 * cookie or header before connecting). Every other operator route requires
 * the cookie or `Authorization: Bearer`, matching the spec's auth surface.
 */
function isAgentsAuthorized(request: Request, env: Env): boolean {
  const queryToken = new URL(request.url).searchParams.get("token");
  return (
    isOperator(request, env.OPERATOR_TOKEN) ||
    (Boolean(env.OPERATOR_TOKEN) && queryToken === env.OPERATOR_TOKEN)
  );
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function turnResultText(result: TurnResultLike): string {
  const text = (result.message?.parts ?? [])
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  return text || "(no response)";
}

async function directory(env: Env) {
  return getAgentByName(env.Directory, "main");
}

async function knownMind(slug: string, env: Env): Promise<boolean> {
  const minds = (await (await directory(env)).listMinds()) as unknown as MindCard[];
  return minds.some((mind) => mind.slug === slug);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/agents/")) {
      if (!isAgentsAuthorized(request, env)) return unauthorized();
      return (
        (await routeAgentRequest(request, env, {
          onBeforeConnect: (connectRequest) =>
            isAgentsAuthorized(connectRequest, env) ? undefined : unauthorized(),
        })) ?? new Response("Not found", { status: 404 })
      );
    }

    const route = matchRoute(url.pathname);
    if (route.kind === "gallery" && request.method === "GET") {
      const minds = (await (await directory(env)).listMinds()) as unknown as MindCard[];
      return new Response(gallery(minds, { operator: isOperator(request, env.OPERATOR_TOKEN) }), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (route.kind === "login") {
      if (request.method === "GET") {
        return new Response(login(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (request.method === "POST") {
        const token = formText(await request.formData(), "token");
        return loginPostResponse(token, env.OPERATOR_TOKEN, url.protocol === "https:");
      }
    }

    if (url.pathname === "/op/login") {
      if (request.method === "GET") return redirect("/login");
      if (request.method === "POST") {
        const token = formText(await request.formData(), "token");
        return loginPostResponse(token, env.OPERATOR_TOKEN, url.protocol === "https:");
      }
    }

    if (route.kind === "mind-public" && request.method === "GET") {
      if (!(await knownMind(route.slug, env))) return new Response("Not found", { status: 404 });
      const mind = await getAgentByName(env.Mind, route.slug);
      const [graph, notes] = await Promise.all([mind.publicGraph(), mind.publicNotes()]);
      return new Response(mindPublic(graph, notes), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (route.kind === "mind-graph" && request.method === "GET") {
      if (!(await knownMind(route.slug, env))) return new Response("Not found", { status: 404 });
      const mind = await getAgentByName(env.Mind, route.slug);
      const graph = await mind.publicGraph();
      return new Response(JSON.stringify(graph), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (route.kind === "mind-note" && request.method === "GET") {
      if (!(await knownMind(route.slug, env))) return new Response("Not found", { status: 404 });
      const mind = await getAgentByName(env.Mind, route.slug);
      const note = await mind.readNote(route.noteId);
      if (note === null) return new Response("Not found", { status: 404 });
      return new Response(note, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
    }

    if (!isOperator(request, env.OPERATOR_TOKEN) && route.kind !== "unknown") return unauthorized();

    if (route.kind === "mind-op" && request.method === "GET") {
      if (!(await knownMind(route.slug, env))) return new Response("Not found", { status: 404 });
      const mind = await getAgentByName(env.Mind, route.slug);
      const view = await mind.operatorView();
      return new Response(mindOperator(route.slug, view), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (route.kind === "op-new") {
      if (request.method === "GET") {
        return new Response(layout("New Mind", `<p><a href="/op/directory">Directory</a></p><h1>New Mind</h1>${newMindForm()}`), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      if (request.method === "POST") {
        const formData = await request.formData();
        const slug = formText(formData, "slug");
        const result = await (await directory(env)).createMind({
          slug,
          name: formText(formData, "name"),
          persona: formText(formData, "persona"),
          core: formText(formData, "core"),
          model: formText(formData, "model") || undefined,
        });
        if (!result.ok) return new Response(result.error, { status: 400 });
        return redirect(`/minds/${encodeURIComponent(slug)}/op`);
      }
    }

    if (route.kind === "op-directory" && request.method === "GET") {
      const minds = (await (await directory(env)).listMinds()) as unknown as MindCard[];
      return new Response(directoryDashboard(minds), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (route.kind === "op-directory-chat" && request.method === "POST") {
      const input = formText(await request.formData(), "input");
      const runTurn = (await directory(env)).runTurn as unknown as (
        payload: { input: string },
      ) => Promise<TurnResultLike>;
      const result = await runTurn({ input });
      return new Response(turnResultText(result));
    }

    if (route.kind === "mind-action" && request.method === "POST") {
      if (!(await knownMind(route.slug, env))) return new Response("Not found", { status: 404 });
      const mind = await getAgentByName(env.Mind, route.slug);
      const formData = await request.formData();
      if (route.action === "queue") await mind.queue(formText(formData, "text"));
      if (route.action === "force") await mind.force(formText(formData, "text"));
      if (route.action === "talk") await mind.talk(formText(formData, "text"));
      if (route.action === "pause") await mind.pause();
      if (route.action === "resume") await mind.resume();
      if (route.action === "model") {
        const result = await mind.setModel(formText(formData, "model"));
        if (!result.ok) return new Response(result.error, { status: 400 });
      }
      return redirect(`/minds/${encodeURIComponent(route.slug)}/op`);
    }

    if (route.kind === "unknown") return env.ASSETS.fetch(request);
    return new Response("Method not allowed", { status: 405 });
  },
};
