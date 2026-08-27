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
  const visible = (graph.thoughts ?? []).filter((thought) => isVisibleThought(thought.body));
  const latest = visible.at(-1);
  if (latest && Date.now() - latest.created_at < 8000) return "thinking";
  if (!visible.length) return "waking";
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
  const brandName = root.querySelector(".brand small");
  if (brandName && graph.name) {
    brandName.textContent = graph.name;
  }
  setMetric(root, "thoughts", String((graph.thoughts ?? []).filter((thought) => isVisibleThought(thought.body)).length));
  setMetric(root, "sessions", String(graph.sessions?.length ?? 0));
  setMetric(root, "open-lines", String(liveLineages(graph).length));
  setMetric(
    root,
    "queue",
    String((graph.agenda ?? []).filter((item) => item.status === "pending" || item.status === "active").length),
  );
  const visible = (graph.thoughts ?? []).filter((thought) => isVisibleThought(thought.body));
  const latest = visible.at(-1);
  setMetric(root, "latest", latest ? age(latest.created_at) : "—");
}

function setMetric(root, name, value) {
  const node = root.querySelector(`[data-metric="${name}"] b`);
  if (node) node.textContent = value;
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

function thoughtBody(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const dumped = /<tool_call\b|<arg_key>/i.test(text);
  const bodyMatch = text.match(/<arg_key>\s*body\s*<\/arg_key>\s*<arg_value>([\s\S]*?)(?:<\/arg_value>|$)/i);
  let source = (bodyMatch ? bodyMatch[1].split(/<arg_key>/i)[0] : dumped ? "" : text)
    .replace(/<\/?(?:tool_call|arg_key|arg_value)[^>]*>/gi, "")
    .replace(/^\s*record_thought\s*/i, "")
    .trim();
  if (!source) return dumped ? "" : text;
  if (dumped && !/<\/arg_value>/i.test(text)) {
    const complete = source.match(/^[\s\S]*[.!?](?=["')\]]|\s|$)/);
    return (complete ? complete[0] : source).trim();
  }
  return source;
}

function isVisibleThought(raw) {
  const text = thoughtBody(raw);
  if (!text) return false;
  if (/^continue examining the core\.?$/i.test(text)) return false;
  if (/tool_call|arg_key|arg_value/i.test(text)) return false;
  return true;
}

function shortThoughtId(id) {
  const value = String(id ?? "");
  return value.length <= 8 ? value : value.slice(0, 8);
}

function thoughtItem(thought, fresh) {
  const li = document.createElement("li");
  li.id = `thought-${thought.id}`;
  li.dataset.thoughtId = thought.id;
  if (fresh) li.classList.add("fresh");
  li.innerHTML = `<p>${escapeHtml(thoughtBody(thought.body))}</p><small><time datetime="${escapeHtml(new Date(thought.created_at).toISOString())}">${escapeHtml(age(thought.created_at))}</time> · <code class="thought-id">${escapeHtml(shortThoughtId(thought.id))}</code> · distance ${Number(thought.distance_to_core).toFixed(2)}</small>`;
  return li;
}

function applyStream(root, graph) {
  const list = root.querySelector("#thought-stream");
  if (!list) return;
  const thoughts = (graph.thoughts ?? []).filter((thought) => isVisibleThought(thought.body));
  if (thoughts.length === 0) return;
  const empty = list.querySelector(".empty-copy");
  if (empty) empty.remove();
  const seen = new Set([...list.querySelectorAll("[data-thought-id]")].map((node) => node.dataset.thoughtId));
  for (const thought of thoughts) {
    if (seen.has(thought.id)) continue;
    list.prepend(thoughtItem(thought, true));
  }
  applyThoughtSearch(root);
}

function applyThoughtSearch(root) {
  const input = root.querySelector("[data-thought-search]");
  const list = root.querySelector("#thought-stream");
  if (!input || !list) return;
  const query = String(input.value ?? "").trim().toLowerCase();
  for (const item of list.querySelectorAll("li[data-thought-id]")) {
    const text = item.querySelector("p")?.textContent?.toLowerCase() ?? "";
    item.hidden = Boolean(query) && !text.includes(query);
  }
}

function learnedParagraphs(text) {
  return String(text ?? "")
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function applyLearned(root, graph) {
  const copy = root.querySelector("#learned-copy");
  if (!copy) return;
  const paragraphs = learnedParagraphs(graph.learned);
  copy.innerHTML = paragraphs.length
    ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
    : `<p class="empty-copy">Nothing folded into a brief yet. After a session lands real observations, this becomes a readable summary of what it has figured out.</p>`;
  const stamp = root.querySelector("#learned .map-head > span");
  if (stamp) {
    stamp.textContent = graph.learnedAt ? `updated ${age(graph.learnedAt)}` : "rewritten as it learns";
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
  applyLearned(root, graph);
  applyExploring(root, graph);
  applyNext(root, graph);
  applyStream(root, graph);
  applySessions(root, graph);
  applyDeadEnds(root, graph);
}

document.addEventListener("DOMContentLoaded", () => {
  const root = shell();
  if (!root) return;
  const search = root.querySelector("[data-thought-search]");
  if (search) {
    search.addEventListener("input", () => applyThoughtSearch(root));
  }
  tick().catch(() => {});
  window.setInterval(() => {
    tick().catch(() => {});
  }, POLL_MS);
});
