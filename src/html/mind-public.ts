import type { GraphPayload } from "../mind/graph";
import { escapeHtml, layout } from "./layout";

function lineageLabel(lineage: GraphPayload["lineages"][number]): string {
  const closed = lineage.closed_at ? " (closed)" : "";
  return `${escapeHtml(lineage.kind)} — ${escapeHtml(lineage.status)}${closed}`;
}

export function mindPublic(graph: GraphPayload, notes: readonly { id: string }[] = []): string {
  const thoughts = graph.thoughts
    .map((thought) => `<li>${escapeHtml(thought.body)}</li>`)
    .join("");
  const agenda = graph.agenda
    .map((item) => `<li>${escapeHtml(item.text)} (${escapeHtml(item.status)})</li>`)
    .join("");
  const noteLinks = notes
    .map(
      (note) =>
        `<li><a href="/minds/${encodeURIComponent(graph.slug)}/notes/${encodeURIComponent(note.id)}">${escapeHtml(note.id)}</a></li>`,
    )
    .join("");
  // Every lineage, including unrelated/parked dead ends, stays visible — the
  // public graph documents the whole trace, not just what stayed connected.
  const lineages = graph.lineages
    .map((lineage) => `<li>${lineageLabel(lineage)}</li>`)
    .join("");
  const sessions = graph.sessions
    .map(
      (session) =>
        `<li>${escapeHtml(session.brief_type)} → ${escapeHtml(session.outcome ?? "(open)")} (${session.thought_count} thoughts)</li>`,
    )
    .join("");

  return layout(
    graph.name,
    `<a href="/">Minds</a>
<h1>${escapeHtml(graph.name)}</h1>
<p class="slug">${escapeHtml(graph.slug)}</p>
<p>${escapeHtml(graph.core)}</p>
<h2>Lineages</h2>
<ul>${lineages || "<li>No lineages yet.</li>"}</ul>
<h2>Sessions</h2>
<ul>${sessions || "<li>No sessions yet.</li>"}</ul>
<h2>Thoughts</h2>
<ul>${thoughts || "<li>No thoughts yet.</li>"}</ul>
<h2>Agenda</h2>
<ul>${agenda || "<li>No agenda items.</li>"}</ul>
<h2>Published notes</h2>
<ul>${noteLinks || "<li>No published notes.</li>"}</ul>`,
  );
}
