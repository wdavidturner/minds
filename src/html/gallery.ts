import { escapeHtml, layout } from "./layout";

export type MindCard = {
  slug: string;
  name: string;
  core_summary: string;
  status: string;
};

export function gallery(minds: readonly MindCard[]): string {
  const cards = minds
    .map(
      (mind) => `<article class="mind-card">
  <h2><a href="/minds/${encodeURIComponent(mind.slug)}">${escapeHtml(mind.name)}</a></h2>
  <p class="slug">${escapeHtml(mind.slug)}</p>
  <p>${escapeHtml(mind.core_summary)}</p>
  <p class="status">${escapeHtml(mind.status)}</p>
</article>`,
    )
    .join("");

  return layout(
    "Minds",
    `<h1>Minds</h1><section class="gallery">${cards || "<p>No minds yet.</p>"}</section>`,
  );
}
