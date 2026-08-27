const POLL_MS = 1500;
const LIVE_STATUSES = new Set(["exploring", "relating", "connected"]);
const DEAD_STATUSES = new Set(["unrelated", "parked", "concluded"]);

function shell() {
  return document.querySelector("[data-mind-dashboard]");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function age(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function activity(graph) {
  if (graph.paused) return "paused";
  if (graph.pondering) return "thinking";
  const latest = graph.thoughts?.at(-1);
  if (latest && Date.now() - latest.created_at < 8000) return "thinking";
  if (!graph.thoughts?.length) return "waking";
  return "hibernating";
}

function liveLineages(graph) {
  return (graph.lineages ?? []).filter((lineage) => LIVE_STATUSES.has(lineage.status) && !lineage.closed_at);
}

function deadLineages(graph) {
  return (graph.lineages ?? []).filter(
    (lineage) => DEAD_STATUSES.has(lineage.status) || lineage.closed_at !== null,
  );
}

function applyStatus(root, graph) {
  const state = activity(graph);
  const pulse = state === "thinking" ? " pulse" : "";
  const status = root.querySelector(".rail-status");
  if (status) {
    status.innerHTML = `<span class="status-dot ${escapeHtml(state)}${pulse}"></span>${escapeHtml(state)}`;
  }
  const chip = root.querySelector(".support-chip");
  if (chip) {
    chip.classList.toggle("attention", state === "thinking");
    chip.innerHTML = `<span class="status-dot ${escapeHtml(state)}${pulse}"></span>${escapeHtml(state)}`;
  }
  const metrics = root.querySelectorAll(".rail-metrics dd");
  if (metrics[0]) metrics[0].textContent = String(graph.thoughts?.length ?? 0);
  if (metrics[1]) metrics[1].textContent = String(graph.sessions?.length ?? 0);
  if (metrics[2]) metrics[2].textContent = String(liveLineages(graph).length);
}

function applyExploring(root, graph) {
  const grid = root.querySelector("#exploring-grid");
  if (!grid) return;
  const items = liveLineages(graph);
  grid.innerHTML =
    items
      .map((lineage) => {
        const closed = lineage.closed_at ? " (closed)" : "";
        return `<article class="topic-card live"><span class="eyebrow">${escapeHtml(lineage.kind)}</span><h3>${escapeHtml(lineage.kind)} — ${escapeHtml(lineage.status)}${closed}</h3><p>${lineage.dig_sessions} dig sessions</p></article>`;
      })
      .join("") || `<p class="empty-copy">Waiting for the first lineage to open.</p>`;
}

function applyNext(root, graph) {
  const grid = root.querySelector("#next-grid");
  if (!grid) return;
  const items = (graph.agenda ?? []).filter((item) => item.status === "pending" || item.status === "active");
  grid.innerHTML =
    items
      .map(
        (item) =>
          `<article class="topic-card next"><span class="eyebrow">${escapeHtml(item.status)}</span><h3>${escapeHtml(item.text)}</h3></article>`,
      )
      .join("") || `<p class="empty-copy">No self-queued questions yet.</p>`;
}

function applySessions(root, graph) {
  const list = root.querySelector("#session-list");
  if (!list) return;
  const items = [...(graph.sessions ?? [])].reverse().slice(0, 8);
  list.innerHTML =
    items
      .map(
        (session) =>
          `<li>${escapeHtml(session.brief_type)} → ${escapeHtml(session.outcome ?? "(open)")} (${session.thought_count} thoughts)</li>`,
      )
      .join("") || `<li>No sessions yet.</li>`;
}

function applyDeadEnds(root, graph) {
  const list = root.querySelector("#dead-list");
  if (!list) return;
  const items = deadLineages(graph);
  list.innerHTML =
    items
      .map((lineage) => {
        const closed = lineage.closed_at ? " (closed)" : "";
        return `<li class="dead-end">${escapeHtml(lineage.kind)} — ${escapeHtml(lineage.status)}${closed}</li>`;
      })
      .join("") || `<li class="empty-copy">No parked or unrelated lines yet.</li>`;
}

function thoughtItem(thought, fresh) {
  const li = document.createElement("li");
  li.dataset.thoughtId = thought.id;
  if (fresh) li.classList.add("fresh");
  li.innerHTML = `<p>${escapeHtml(thought.body)}</p><small>${escapeHtml(age(thought.created_at))} · distance ${Number(thought.distance_to_core).toFixed(2)}</small>`;
  return li;
}

function applyStream(root, graph) {
  const list = root.querySelector("#thought-stream");
  if (!list) return;
  const thoughts = graph.thoughts ?? [];
  if (thoughts.length === 0) return;
  const empty = list.querySelector(".empty-copy");
  if (empty) empty.remove();
  const seen = new Set([...list.querySelectorAll("[data-thought-id]")].map((node) => node.dataset.thoughtId));
  for (const thought of thoughts) {
    if (seen.has(thought.id)) continue;
    list.prepend(thoughtItem(thought, true));
  }
}

async function tick() {
  const root = shell();
  if (!root) return;
  const url = root.getAttribute("data-graph");
  if (!url) return;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return;
  const graph = await response.json();
  applyStatus(root, graph);
  applyExploring(root, graph);
  applyNext(root, graph);
  applyStream(root, graph);
  applySessions(root, graph);
  applyDeadEnds(root, graph);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!shell()) return;
  tick().catch(() => {});
  window.setInterval(() => {
    tick().catch(() => {});
  }, POLL_MS);
});
