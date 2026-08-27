import { escapeHtml, layout } from "./layout";

export type MindCard = {
  slug: string;
  name: string;
  core_summary: string;
  status: string;
};

function card(mind: MindCard): string {
  const pub = `/minds/${encodeURIComponent(mind.slug)}`;
  const op = `/minds/${encodeURIComponent(mind.slug)}/op`;
  return `<article class="dir-card">
  <div class="dir-card-main">
    <p class="eyebrow">${escapeHtml(mind.status)}</p>
    <h2>${escapeHtml(mind.name)}</h2>
    <p class="slug">${escapeHtml(mind.slug)}</p>
    <p class="topic">${escapeHtml(mind.core_summary)}</p>
  </div>
  <p class="dir-card-actions">
    <a class="btn" href="${pub}">Public page</a>
    <a class="btn ghost" href="${op}">Operator</a>
  </p>
</article>`;
}

export function gallery(minds: readonly MindCard[]): string {
  const cards = minds.map(card).join("");
  return layout(
    "Minds",
    `<header class="dir-head">
  <div>
    <p class="eyebrow">Gallery</p>
    <h1>Minds</h1>
    <p class="lede">Public traces of inner monologues. Open a card’s public page to watch, or the operator panel to steer.</p>
  </div>
  <a class="primary" href="/op/directory">Operator panel</a>
</header>
<section class="dir-grid">${cards || "<p class=\"empty-copy\">No minds yet.</p>"}</section>`,
  );
}
