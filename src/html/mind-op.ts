import { workerDashboardUrl, workerObservabilityUrl } from "../cloudflare-links";
import type { BriefType, LineageKind, LineageStatus } from "../types";
import { escapeHtml, layout } from "./layout";
import { modelSelect } from "./model-select";

export type OperatorView = {
  paused: boolean;
  pondering: boolean;
  storageFull: boolean;
  nextBrief: BriefType;
  queuedCount: number;
  inbox: readonly string[];
  activeLineage: { kind: LineageKind; status: LineageStatus } | null;
  lastSession: {
    briefType: BriefType | string;
    outcome: string | null;
    thoughtCount: number;
  } | null;
  model: string;
  modelOverride: string;
};

function activity(view: OperatorView): string {
  if (view.paused) return "paused";
  if (view.pondering) return "in a session";
  if (!view.lastSession) return "waiting for first session";
  return "hibernating until next wake";
}

function lineageLabel(view: OperatorView): string {
  if (!view.activeLineage) return "none";
  return `${view.activeLineage.kind} — ${view.activeLineage.status}`;
}

function lastSessionLabel(view: OperatorView): string {
  if (!view.lastSession) return "none yet";
  const outcome = view.lastSession.outcome ?? "(open)";
  return `${view.lastSession.briefType} → ${outcome} (${view.lastSession.thoughtCount} thoughts)`;
}

function queuedList(view: OperatorView): string {
  if (view.inbox.length === 0) {
    return `<p class="empty-copy">Nothing waiting. Queue a probe and the Mind will consider it when ready.</p>`;
  }
  return `<ul class="queue-list">${view.inbox.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function mindOperator(slug: string, view: OperatorView): string {
  const action = `/op/minds/${encodeURIComponent(slug)}`;
  const safeSlug = escapeHtml(slug);
  const publicHref = `/minds/${encodeURIComponent(slug)}`;
  const storageAlert = view.storageFull
    ? `<p role="alert">Storage is full. Thought writes are paused and a long retry has been scheduled.</p>`
    : "";
  const wakeLabel = view.paused ? "Resume" : "Pause";
  const wakePath = view.paused ? "resume" : "pause";
  return layout(
    `${slug} — Minds`,
    `<header class="op-chrome">
  <a class="btn ghost" href="/op/directory">Go back to directory</a>
  <div class="op-chrome-end">
    <form class="inline-form" method="post" action="${action}/model">
      ${modelSelect(view.modelOverride, { compact: true })}
    </form>
    <a class="btn" href="${publicHref}">Public page</a>
    <a class="btn ghost" href="${escapeHtml(workerDashboardUrl())}" target="_blank" rel="noreferrer">Cloudflare dashboard</a>
    <a class="btn ghost" href="${escapeHtml(workerObservabilityUrl(slug))}" target="_blank" rel="noreferrer">${escapeHtml("Logs & traces")}</a>
    <form class="inline-form" method="post" action="${action}/${wakePath}">
      <button class="btn${view.paused ? "" : " danger"}" type="submit">${wakeLabel}</button>
    </form>
  </div>
</header>
<h1>${safeSlug}</h1>
${storageAlert}
<section class="operator-status">
  <p><span class="status">${escapeHtml(activity(view))}</span></p>
  <dl>
    <dt>Next brief</dt>
    <dd>${escapeHtml(view.nextBrief)}</dd>
    <dt>Lineage</dt>
    <dd>${escapeHtml(lineageLabel(view))}</dd>
    <dt>Last session</dt>
    <dd>${escapeHtml(lastSessionLabel(view))}</dd>
  </dl>
</section>
<section class="compose">
  <input type="radio" name="compose-tab" id="compose-queue" checked>
  <input type="radio" name="compose-tab" id="compose-force">
  <input type="radio" name="compose-tab" id="compose-talk">
  <div class="compose-tabs" role="tablist">
    <label for="compose-queue">Queue <b>${view.queuedCount}</b></label>
    <label for="compose-force">Force</label>
    <label for="compose-talk">Talk</label>
  </div>
  <form class="compose-panel" id="panel-queue" method="post" action="${action}/queue">
    ${queuedList(view)}
    <label>Suggestion <textarea name="text" required placeholder="Sits until the Mind is ready. It may ignore it."></textarea></label>
    <button>Queue</button>
  </form>
  <form class="compose-panel" id="panel-force" method="post" action="${action}/force">
    <p class="empty-copy">Interrupts the current session and starts a new lineage for this probe.</p>
    <label>Suggestion <textarea name="text" required placeholder="Relate this to the core, now."></textarea></label>
    <button>Force</button>
  </form>
  <form class="compose-panel" id="panel-talk" method="post" action="${action}/talk">
    <p class="empty-copy">Stays on the current line. Does not start a new suggestion.</p>
    <label>Utterance <textarea name="text" required placeholder="Lean over and talk while it thinks."></textarea></label>
    <button>Talk</button>
  </form>
</section>`,
  );
}
