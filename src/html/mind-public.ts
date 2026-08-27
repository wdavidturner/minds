import type { GraphPayload } from "../mind/graph";
import { escapeHtml, layout } from "./layout";

export function mindPublic(graph: GraphPayload): string {
  const thoughts = graph.thoughts
    .map((thought) => `<li>${escapeHtml(thought.body)}</li>`)
    .join("");
  const agenda = graph.agenda
    .map((item) => `<li>${escapeHtml(item.text)} (${escapeHtml(item.status)})</li>`)
    .join("");

  return layout(
    graph.name,
    `<a href="/">Minds</a>
<h1>${escapeHtml(graph.name)}</h1>
<p class="slug">${escapeHtml(graph.slug)}</p>
<p>${escapeHtml(graph.core)}</p>
<h2>Thoughts</h2>
<ul>${thoughts || "<li>No thoughts yet.</li>"}</ul>
<h2>Agenda</h2>
<ul>${agenda || "<li>No agenda items.</li>"}</ul>`,
  );
}
