import type { GraphPayload } from "../mind/graph";
import { modelLabel } from "../models";
import { escapeHtml } from "./layout";

const LIVE_STATUSES = new Set(["exploring", "relating", "connected"]);
const DEAD_STATUSES = new Set(["unrelated", "parked", "concluded"]);

function age(ms: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function activity(graph: GraphPayload): string {
  if (graph.paused) return "paused";
  if (graph.pondering) return "thinking";
  const latest = graph.thoughts.at(-1);
  if (latest && Date.now() - latest.created_at < 8_000) return "thinking";
  if (graph.thoughts.length === 0) return "waking";
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

export function dashboardRail(graph: GraphPayload): string {
  const state = activity(graph);
  const pulse = state === "thinking" ? " pulse" : "";
  return `<aside class="rail">
  <a class="brand" href="/"><span class="brand-mark">M</span><strong>Minds</strong><small>${escapeHtml(graph.slug)}</small></a>
  <p class="rail-label">Status</p>
  <p class="rail-status"><span class="status-dot ${escapeHtml(state)}${pulse}"></span>${escapeHtml(state)}</p>
  <p class="rail-label">Model</p>
  <p>${escapeHtml(modelLabel(graph.model ?? "default"))}</p>
  <dl class="rail-metrics">
    <div><dt>Thoughts</dt><dd>${graph.thoughts.length}</dd></div>
    <div><dt>Sessions</dt><dd>${graph.sessions.length}</dd></div>
    <div><dt>Live lines</dt><dd>${liveLineages(graph).length}</dd></div>
  </dl>
  <div class="rail-note">
    <span>Public trace</span>
    <p>This page updates as thoughts land, including mid-session.</p>
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
  return `<section class="band">
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
  return `<section class="band">
  <div class="map-head"><div><p class="eyebrow">Up next</p><h2>Questions it owes itself</h2></div><span>${items.length} queued</span></div>
  <div class="topic-grid" id="next-grid">${cards || "<p class=\"empty-copy\">No self-queued questions yet.</p>"}</div>
</section>`;
}

export function dashboardStream(graph: GraphPayload): string {
  const thoughts = [...graph.thoughts].reverse();
  const items = thoughts
    .map(
      (thought) => `<li data-thought-id="${escapeHtml(thought.id)}">
  <p>${escapeHtml(thought.body)}</p>
  <small>${escapeHtml(age(thought.created_at))} · distance ${thought.distance_to_core.toFixed(2)}</small>
</li>`,
    )
    .join("");
  return `<section class="band stream-band">
  <div class="map-head"><div><p class="eyebrow">Thought stream</p><h2>What it is noticing</h2></div><span>${graph.thoughts.length}</span></div>
  <ol class="thought-stream" id="thought-stream">${items || "<li class=\"empty-copy\">No thoughts yet.</li>"}</ol>
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
  return `<section class="band dead-band">
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
  return `<section class="band">
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

export function dashboardWorkspace(graph: GraphPayload, notes: readonly { id: string }[] = []): string {
  const state = activity(graph);
  return `<div class="workspace">
  <header class="workspace-head">
    <div>
      <p class="eyebrow">The core</p>
      <h1>${escapeHtml(graph.name)}</h1>
      <p class="core-copy">${escapeHtml(graph.core)}</p>
    </div>
    <p class="support-chip ${state === "thinking" ? "attention" : ""}"><span class="status-dot ${escapeHtml(state)}${state === "thinking" ? " pulse" : ""}"></span>${escapeHtml(state)}</p>
  </header>
  <div id="dashboard-live">
    ${dashboardExploring(graph)}
    ${dashboardNext(graph)}
    ${dashboardStream(graph)}
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
