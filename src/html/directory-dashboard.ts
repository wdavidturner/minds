import type { MindCard } from "./gallery";
import { escapeHtml, layout } from "./layout";

function card(mind: MindCard): string {
  const op = `/minds/${encodeURIComponent(mind.slug)}/op`;
  const pub = `/minds/${encodeURIComponent(mind.slug)}`;
  return `<article class="dir-card">
  <a class="dir-card-main" href="${op}">
    <p class="eyebrow">${escapeHtml(mind.status)}</p>
    <h2>${escapeHtml(mind.name)}</h2>
    <p class="slug">${escapeHtml(mind.slug)}</p>
    <p class="topic">${escapeHtml(mind.core_summary)}</p>
  </a>
  <p class="dir-card-meta">
    <a href="${pub}">Public page</a>
    <a href="${op}">Operator</a>
  </p>
</article>`;
}

export function directoryDashboard(minds: readonly MindCard[]): string {
  const cards = minds.map(card).join("");
  const body = `<header class="dir-head">
  <div>
    <p class="eyebrow">Operator</p>
    <h1>Directory</h1>
    <p class="lede">Your Minds. Open a card to talk, change the model, or steer a session.</p>
  </div>
  <a class="primary" href="/op/new">New Mind</a>
</header>
<section class="dir-grid">${cards || "<p class=\"empty-copy\">No minds yet. Create one to start a core.</p>"}</section>`;
  return layout("Directory", body);
}
