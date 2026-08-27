import { escapeHtml, layout } from "./layout";

export function mindOperator(slug: string, storageFull = false): string {
  const action = `/op/minds/${encodeURIComponent(slug)}`;
  const safeSlug = escapeHtml(slug);
  const storageAlert = storageFull
    ? `<p role="alert">Storage is full. Thought writes are paused and a long retry has been scheduled.</p>`
    : "";
  return layout(
    `${slug} — Minds`,
    `<a href="/minds/${encodeURIComponent(slug)}">Public page</a>
<h1>${safeSlug}</h1>
${storageAlert}
<section class="operator-actions">
  <form method="post" action="${action}/queue"><label>Queue <input name="text" required></label><button>Queue</button></form>
  <form method="post" action="${action}/force"><label>Force <input name="text" required></label><button>Force</button></form>
  <form method="post" action="${action}/talk"><label>Talk <input name="text" required></label><button>Talk</button></form>
  <form method="post" action="${action}/pause"><button>Pause</button></form>
  <form method="post" action="${action}/resume"><button>Resume</button></form>
</section>`,
  );
}
