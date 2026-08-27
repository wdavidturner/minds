import { getAgentByName, routeAgentRequest } from "agents";
import { isOperator, operatorCookieHeader, unauthorized } from "./auth";
import { gallery, type MindCard } from "./html/gallery";
import { login } from "./html/login";
import { mindOperator } from "./html/mind-op";
import { mindPublic } from "./html/mind-public";
import { newMindForm } from "./html/new-mind-form";
import { layout } from "./html/layout";
import type { Env } from "./env";
import { matchRoute } from "./routes";

export { matchRoute } from "./routes";

function isAuthorized(request: Request, env: Env): boolean {
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

function directoryPage(): string {
  return layout(
    "Directory",
    `<h1>Directory</h1>
${newMindForm()}
<form method="post" action="/op/directory/chat">
  <label>Message <textarea name="input" required></textarea></label>
  <button>Send</button>
</form>`,
  );
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
      if (!isAuthorized(request, env)) return unauthorized();
      return (
        (await routeAgentRequest(request, env, {
          onBeforeConnect: (connectRequest) =>
            isAuthorized(connectRequest, env) ? undefined : unauthorized(),
        })) ?? new Response("Not found", { status: 404 })
      );
    }

    const route = matchRoute(url.pathname);
    if (route.kind === "gallery" && request.method === "GET") {
      const minds = (await (await directory(env)).listMinds()) as unknown as MindCard[];
      return new Response(gallery(minds), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (route.kind === "login" && request.method === "GET") {
      return new Response(login(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (url.pathname === "/op/login" && request.method === "POST") {
      const token = formText(await request.formData(), "token");
      if (!env.OPERATOR_TOKEN || token !== env.OPERATOR_TOKEN) return unauthorized();
      return new Response(null, {
        status: 303,
        headers: { Location: "/", "Set-Cookie": operatorCookieHeader(token) },
      });
    }

    if (route.kind === "mind-public" && request.method === "GET") {
      if (!(await knownMind(route.slug, env))) return new Response("Not found", { status: 404 });
      const mind = await getAgentByName(env.Mind, route.slug);
      return new Response(mindPublic(await mind.publicGraph()), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!isAuthorized(request, env) && route.kind !== "unknown") return unauthorized();

    if (route.kind === "mind-op" && request.method === "GET") {
      if (!(await knownMind(route.slug, env))) return new Response("Not found", { status: 404 });
      const mind = await getAgentByName(env.Mind, route.slug);
      const { storageFull } = await mind.storageStatus();
      return new Response(mindOperator(route.slug, storageFull), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (route.kind === "op-new") {
      if (request.method === "GET") {
        return new Response(layout("New Mind", `<h1>New Mind</h1>${newMindForm()}`), {
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
        });
        if (!result.ok) return new Response(result.error, { status: 400 });
        return redirect(`/minds/${encodeURIComponent(slug)}/op`);
      }
    }

    if (route.kind === "op-directory" && request.method === "GET") {
      return new Response(directoryPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (route.kind === "op-directory-chat" && request.method === "POST") {
      const input = formText(await request.formData(), "input");
      const runTurn = (await directory(env)).runTurn as unknown as (
        payload: { input: string },
      ) => Promise<unknown>;
      const result = await runTurn({ input });
      return new Response(String(result));
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
      return redirect(`/minds/${encodeURIComponent(route.slug)}/op`);
    }

    if (route.kind === "unknown") return env.ASSETS.fetch(request);
    return new Response("Method not allowed", { status: 405 });
  },
};
