import type { GraphPayload } from "../mind/graph";
import { isVisibleThoughtBody, presentThoughtBody } from "../mind/thought-body";
import { modelLabel } from "../models";
import { brandMark, escapeHtml } from "./layout";
import { learnedParagraphs } from "../mind/learning-summary";

const LIVE_STATUSES = new Set(["exploring", "relating", "connected"]);
const DEAD_STATUSES = new Set(["unrelated", "parked", "concluded"]);

function age(ms: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function visibleThoughts(graph: GraphPayload) {
  return graph.thoughts.filter((thought) => isVisibleThoughtBody(thought.body));
}

function activity(graph: GraphPayload): string {
  if (graph.paused) return "paused";
  if (graph.pondering) return "thinking";
  const latest = visibleThoughts(graph).at(-1);
  if (latest && Date.now() - latest.created_at < 8_000) return "thinking";
  if (visibleThoughts(graph).length === 0) return "waking";
  return "hibernating";
}

function liveLineages(graph: GraphPayload) {
  return graph.lineages.filter((lineage) => LIVE_STATUSES.has(lineage.status) && !lineage.closed_at);
}

function deadLineages(graph: GraphPayload) {
  return graph.lineages.filter(
    (lineage) => DEAD_STATUSES.has(lineage.status) || lineage.closed_at !== null,
  );
}

function nextItems(graph: GraphPayload) {
  return graph.agenda.filter((item) => item.status === "pending" || item.status === "active");
}

function shortThoughtId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}

export function dashboardRail(graph: GraphPayload): string {
  const state = activity(graph);
  const pulse = state === "thinking" ? " pulse" : "";
  const thoughts = visibleThoughts(graph);
  const latest = thoughts.at(-1);
  return `<aside class="rail">
  <a class="brand" href="/">${brandMark()}<strong>Minds</strong><small>${escapeHtml(graph.name)}</small></a>
  <nav class="rail-metrics" aria-label="Jump to">
    <a class="rail-metric" data-metric="thoughts" href="#noticing" title="Observations in the stream">
      <span>Thoughts</span><b>${thoughts.length}</b>
    </a>
    <a class="rail-metric" data-metric="sessions" href="#sessions" title="Wakes so far">
      <span>Sessions</span><b>${graph.sessions.length}</b>
    </a>
    <a class="rail-metric" data-metric="open-lines" href="#open-lines" title="Lines of inquiry still being explored">
      <span>Open lines</span><b>${liveLineages(graph).length}</b>
    </a>
    <a class="rail-metric" data-metric="queue" href="#queue" title="Questions it queued for itself">
      <span>Queue</span><b>${nextItems(graph).length}</b>
    </a>
    <a class="rail-metric" href="#learned" title="A brief of what it has figured out">
      <span>Learned</span><b>${graph.learned?.trim() ? "brief" : "—"}</b>
    </a>
    <a class="rail-metric" data-metric="latest" href="#noticing" title="Most recent thought">
      <span>Latest</span><b>${latest ? escapeHtml(age(latest.created_at)) : "—"}</b>
    </a>
  </nav>
  <div class="rail-foot">
    <p class="rail-status"><span class="status-dot ${escapeHtml(state)}${pulse}"></span>${escapeHtml(state)}</p>
    <p class="rail-model">${escapeHtml(modelLabel(graph.model ?? "default"))}</p>
  </div>
</aside>`;
}

export function dashboardExploring(graph: GraphPayload): string {
  const items = liveLineages(graph);
  const cards = items
    .map((lineage) => {
      const closed = lineage.closed_at ? " (closed)" : "";
      return `<article class="topic-card live">
  <span class="eyebrow">${escapeHtml(lineage.kind)}</span>
  <h3>${escapeHtml(lineage.kind)} — ${escapeHtml(lineage.status)}${closed}</h3>
  <p>${lineage.dig_sessions} dig sessions</p>
</article>`;
    })
    .join("");
  return `<section class="pane" id="open-lines">
  <div class="map-head"><div><p class="eyebrow">Now exploring</p><h2>Open lines</h2></div><span>${items.length} live</span></div>
  <div class="topic-grid" id="exploring-grid">${cards || "<p class=\"empty-copy\">Waiting for the first lineage to open.</p>"}</div>
</section>`;
}

export function dashboardNext(graph: GraphPayload): string {
  const items = nextItems(graph);
  const cards = items
    .map(
      (item) => `<article class="topic-card next">
  <span class="eyebrow">${escapeHtml(item.status)}</span>
  <h3>${escapeHtml(item.text)}</h3>
</article>`,
    )
    .join("");
  return `<section class="pane" id="queue">
  <div class="map-head"><div><p class="eyebrow">Up next</p><h2>Questions it owes itself</h2></div><span>${items.length} queued</span></div>
  <div class="topic-grid" id="next-grid">${cards || "<p class=\"empty-copy\">No self-queued questions yet.</p>"}</div>
</section>`;
}

export function dashboardStream(graph: GraphPayload): string {
  const thoughts = [...visibleThoughts(graph)].reverse();
  const items = thoughts
    .map((thought) => {
      const body = presentThoughtBody(thought.body);
      return `<li id="thought-${escapeHtml(thought.id)}" data-thought-id="${escapeHtml(thought.id)}">
  <p>${escapeHtml(body)}</p>
  <small><time datetime="${escapeHtml(isoTime(thought.created_at))}">${escapeHtml(age(thought.created_at))}</time> · <code class="thought-id">${escapeHtml(shortThoughtId(thought.id))}</code> · distance ${thought.distance_to_core.toFixed(2)}</small>
</li>`;
    })
    .join("");
  return `<section class="band stream-band" id="noticing">
  <div class="map-head">
    <div><p class="eyebrow">Thought stream</p><h2>What it is noticing</h2></div>
    <label class="thought-search">
      <span class="eyebrow">Search</span>
      <input type="search" data-thought-search placeholder="Filter thoughts" autocomplete="off">
    </label>
  </div>
  <div class="thought-scroll">
    <ol class="thought-stream" id="thought-stream">${items || "<li class=\"empty-copy\">No thoughts yet.</li>"}</ol>
  </div>
</section>`;
}

export function dashboardDeadEnds(graph: GraphPayload): string {
  const items = deadLineages(graph);
  const cards = items
    .map((lineage) => {
      const closed = lineage.closed_at ? " (closed)" : "";
      return `<li class="dead-end">${escapeHtml(lineage.kind)} — ${escapeHtml(lineage.status)}${closed}</li>`;
    })
    .join("");
  return `<section class="band dead-band" id="dead-ends">
  <div class="map-head"><div><p class="eyebrow">Dead ends</p><h2>Lines it stopped stretching</h2></div><span>${items.length}</span></div>
  <ul id="dead-list">${cards || "<li class=\"empty-copy\">No parked or unrelated lines yet.</li>"}</ul>
</section>`;
}

export function dashboardSessions(graph: GraphPayload): string {
  const items = [...graph.sessions]
    .reverse()
    .slice(0, 8)
    .map(
      (session) =>
        `<li>${escapeHtml(session.brief_type)} → ${escapeHtml(session.outcome ?? "(open)")} (${session.thought_count} thoughts)</li>`,
    )
    .join("");
  return `<section class="band" id="sessions">
  <div class="map-head"><div><p class="eyebrow">Sessions</p><h2>How wakes have ended</h2></div></div>
  <ul class="session-list" id="session-list">${items || "<li>No sessions yet.</li>"}</ul>
</section>`;
}

export function dashboardNotes(
  graph: GraphPayload,
  notes: readonly { id: string }[],
): string {
  const links = notes
    .map(
      (note) =>
        `<li><a href="/minds/${encodeURIComponent(graph.slug)}/notes/${encodeURIComponent(note.id)}">${escapeHtml(note.id)}</a></li>`,
    )
    .join("");
  return `<section class="band">
  <div class="map-head"><div><p class="eyebrow">Published notes</p><h2>What it wrote down</h2></div></div>
  <ul>${links || "<li>No published notes.</li>"}</ul>
</section>`;
}

export function dashboardLearned(graph: GraphPayload): string {
  const paragraphs = learnedParagraphs(graph.learned ?? "");
  const body = paragraphs.length
    ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
    : `<p class="empty-copy">Nothing folded into a brief yet. After a session lands real observations, this becomes a readable summary of what it has figured out.</p>`;
  const updated = graph.learnedAt
    ? `<span>updated ${escapeHtml(age(graph.learnedAt))}</span>`
    : `<span>rewritten as it learns</span>`;
  return `<section class="band learned-band" id="learned">
  <div class="map-head"><div><p class="eyebrow">Working brief</p><h2>What it has learned</h2></div>${updated}</div>
  <div class="learned-copy" id="learned-copy">${body}</div>
</section>`;
}

export function dashboardWorkspace(graph: GraphPayload, notes: readonly { id: string }[] = []): string {
  return `<div class="workspace">
  <header class="workspace-head">
    <div>
      <p class="eyebrow">The core</p>
      <h1>${escapeHtml(graph.name)}</h1>
      <p class="core-copy">${escapeHtml(graph.core)}</p>
    </div>
  </header>
  <div id="dashboard-live">
    ${dashboardLearned(graph)}
    ${dashboardStream(graph)}
    <div class="split-band">
      ${dashboardExploring(graph)}
      ${dashboardNext(graph)}
    </div>
    ${dashboardSessions(graph)}
    ${dashboardDeadEnds(graph)}
    ${dashboardNotes(graph, notes)}
  </div>
</div>`;
}

export function mindDashboard(graph: GraphPayload, notes: readonly { id: string }[] = []): string {
  return `<div class="shell" data-mind-dashboard data-slug="${escapeHtml(graph.slug)}" data-graph="/minds/${encodeURIComponent(graph.slug)}.json">
${dashboardRail(graph)}
${dashboardWorkspace(graph, notes)}
</div>`;
}
