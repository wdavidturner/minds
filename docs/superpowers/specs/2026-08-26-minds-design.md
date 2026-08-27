# Minds

An early-alpha Cloudflare app for long-running inner-monologue agents. A human message does not start a session. It lands as an observation or a queued probe. Each **Mind** keeps thinking on a durable core topic, hibernates between sessions, and publishes a public graph of what it thought.

Inspired by [Headlong](https://github.com/laude-institute/headlong) persistent agency. Built on Cloudflare Think, Durable Objects, and Workers AI. Not a port of `shellm`.

## Goal

Run one or more isolated Minds. Each Mind:

- Has a name, persona, and **core** (the rail). The first Mind we create will explore “family hub” as *data*, not as code.
- Ponders in **sessions** of many model calls on the same line of thought.
- Accepts operator **queue**, **force**, and **talk**.
- Tags every thought that came from a suggestion so that lineage is retrievable.
- Stops stretching a probe that does not relate to the core (e.g. “price of rice in China” vs “family hub”).
- Documents publicly, including dead ends.
- Hibernates; sets its own next wake.

Quality bar: a stranger can clone, deploy, set a token, create a Mind, and watch it think. Not a polished product. No topic-specific hardcoding.

## Non-goals (v1)

- Porting Headlong/`shellm` (real bash, nested `shellm`, Docker).
- Inter-Mind RPC, shared memory, or debate. Same-topic clones with different temperament are allowed; they do not talk. Importing another Mind’s trace into a new Mind is later.
- Browser automation, Cloudflare Sandbox/containers, AI Gateway, Anthropic/OpenAI keys.
- Per-Mind ACLs, Cloudflare Access (optional in front later).
- Temperament tuning UI beyond storing defaults and listing them on the Directory.
- Multiplayer public inject. Public is read-only.

## Architecture

Two Durable Object classes, both Think agents, plus a Worker that routes HTTP.

```
Worker
  GET  /                         gallery (Directory, public)
  POST /op/*                     operator (token)
  GET  /minds/:slug              public Mind
  GET  /minds/:slug/op           operator Mind UI
  /agents/directory/main         Directory chat (token)
  /agents/mind/:slug             Mind WS; operator talk maps to Talk, not a new session

Directory (Think)                one instance, name "main"
  index of Minds
  create / list / archive / describe / set_temperament
  may write gallery HTML into its workspace

Mind (Think)                     one instance per slug
  own SQLite, workspace, alarms
  session loop, graph, public files
```

Think supplies SQLite, workspace (`@cloudflare/shell`), hibernation, alarms, chat plumbing, and recovery. The **mind loop** is ours: we drive many thought steps per alarm; we do not rely on a single `runTurn` to keep pondering.

`getAgentByName(env.Mind, slug)` creates the DO on first access. Durable Objects cannot be listed, so the Directory is the index.

## Identity (data, not code)

A Mind is created with:

| Field | Role |
|---|---|
| `slug` | URL id, unique, kebab-case |
| `name` | display / self-name |
| `persona` | markdown |
| `core` | the rail: topic + question |
| `temperament` | four floats 0–1, **all 0.5 in v1** |

“Family hub” appears only when an operator types it into `core`. README may use that as the example create.

## Auth

One deployment-wide `OPERATOR_TOKEN` (Worker secret).

- Public routes: no auth.
- Directory chat, Directory tools, Mind operator UI, queue/force/talk, pause/resume: require the token (cookie or `Authorization: Bearer`).
- Agent WebSocket `onBeforeConnect` rejects unauthenticated operator sockets.

No per-Mind tokens in v1.

## Objects

**Core** — one per Mind. Distance is always to this, never to the latest inject.

**Suggestion** — queued (or force-created) probe from the operator. Picking or forcing creates a **lineage**. Talk is not a suggestion.

**Utterance** — Talk (and other observations) attached to a lineage.

**Lineage** — the tag. All thoughts from that probe carry `lineage_id` and `suggestion_id` when applicable. Retrieval is “everything under this tag,” including closed dead ends.

**Session** — one wake. Has a **brief** (input, gated) and eventually an **outcome** (output, legal menu). Contains many **thoughts**.

**Thought** — node: parent, session, lineage, distance-to-core, timestamps.

**Agenda item** — child work written by an `expand` outcome, linked to the origin session/thought. Not a session until a later brief is `pursue_agenda`.

## Operator verbs

| Verb | Wakes the Mind? | New lineage? | Behavior |
|---|---|---|---|
| **Queue** | No | Only if the Mind later picks it | Inbox. Mind may pick, defer, or ignore when the gate allows a glance. |
| **Force** | Yes | Always | Abort in-flight session, stash current lineage, insert suggestion, open relating lineage, run a session now. |
| **Talk** | Yes | No | Abort in-flight generation, attach text to the **active** lineage, continue that pattern. |

If nothing is active, Talk attaches to the most recent open lineage, else the core lineage. Force and Talk both **abort** in-flight generation (persist any partial thought already recorded), then start a new session. They do not wait for the current model call to finish.

## Brief gate (`decideBrief`)

No model vote. First match wins:

1. **Force** pending → `relate` (new tagged lineage).
2. **Talk** pending → `talk` (active lineage + utterance).
3. **Agenda nonempty** → `pursue_agenda` (next pending item).
4. **Mid-dig** on a relating or exploring line, cap not hit → `dig` (same focus).
5. **Relating** lineage still open → `relate`.
6. **Open branch** on core or a connected lineage → `continue_line`. **Default.** Does not hop after one thought.
7. **Inbox nonempty and no live branch** → `inbox_glance`. The model may `select_suggestion` (creates a relating lineage; the **rest of this session** runs as `relate`) or `ignore_inbox` (the rest of this session runs as `grow_frontier`). Ignoring is allowed.
8. **Grow frontier** — no live branch and inbox empty (or just ignored). Generate next core questions, then think about one of them.

The model does not choose the next brief. It writes state (agenda, conclude, unrelated). The next wake computes the brief again.

## Legal outcomes

Chosen only after the session minimum thought count, or when the time signal says wind down. Illegal tools error; the loop continues.

| Brief | Legal outcomes |
|---|---|
| `continue_line` | `continue_line`, `expand`, `conclude`, `park`, `noop` |
| `pursue_agenda` | `continue_line` (this item), `expand` (children), `conclude` (item; learning allowed with no route), `park` |
| `relate` | `connected`, `unrelated`, `dig` |
| `talk` | same menu as the active lineage’s brief |
| `dig` | same as the lineage’s current phase (`relate` or `continue_line` menus) |
| `inbox_glance` | `select_suggestion`, `ignore_inbox` (then the session continues under `relate` or `grow_frontier`) |
| `grow_frontier` | `continue_line`, `expand`, `noop` |

**Meanings:**

- **`noop`** — looked, nothing. Thin tagged thought. Probe closes if this was a shallow relate glance; core frontier otherwise unchanged. Next wake may sleep longer.
- **`expand`** — write agenda items linked to this session. Next briefs become `pursue_agenda`. Does not spawn sessions immediately.
- **`dig`** — same question next session; increment `dig_sessions`. Cap **4** sessions on one relating probe.
- **`conclude`** — learned something; no further route as a direction. Write the learning. Close this focus/agenda item. Lineage stays retrievable.
- **`connected`** — probe relates to the core. Status → connected. Later briefs treat it like a core branch (distance still to core).
- **`unrelated`** — no real link. Stop stretching. Close lineage. Restore stashed core lineage. Public graph keeps the branch.
- **`park`** — this *branch* drifted from core. Stop the route, keep nodes, return toward core.
- **`continue_line`** (outcome) — no close; same line next time. **Default if the session hits a stop with no outcome.**

**Publish** is a flag on any successful thought/outcome (`publish_note`), not an outcome type.

## Session loop

One alarm (or force/talk wake) = one **session** = many model calls, then `set_wake`, then hibernate.

```
brief = decideBrief(state)          // no model
session_start = now
until platform alarm approaches or end_session:
    inject: brief, legal outcomes, recent line, graph slice,
            thought_count, min_thoughts,
            elapsed, remaining_until_alarm, wind_down?
    thought = model(...)
    record_thought                  // tagged, parented, distance
    if thought_count < minimum: ignore "I'm done" / illegal end_session
if no outcome: outcome = continue_line
refresh public files
ensure set_wake                     // default alarm if the model forgot
hibernate
```

Drive this loop in the alarm/RPC handler. Do not depend on one Think `runTurn` to keep going.

**Minimum thoughts per session: 8.** Early `end_session` is rejected until then (unless remaining time is already in wind-down). `select_suggestion` and `ignore_inbox` are allowed before the minimum; they change the brief inside the same session, they do not end it.

**Sleep:** after a hot line (agenda or dig) ~30–60s. After noop/idle ~10–15 min. Queue does not wake. Force and talk do.

**First boot:** core lineage exists, no thoughts. Brief is `inbox_glance` if the operator already queued something, else `grow_frontier`. No parent session type.

## Time signal

Timestamp session start. Every thought prompt includes elapsed time and remaining time until the Durable Object alarm (platform ~15 minutes wall). Optional soft wind-down when remaining is small: prefer `conclude` / `continue_line` / `set_wake` over a large `expand`.

v1 does not enforce a 12-minute product cap. The platform alarm is the hard stop. Always persist thoughts and set the next wake before exit so a kill cannot lose the line.

## Temperament

Stored on each Mind and snapshotted on the Directory row:

- `branching`, `persistence`, `curiosity`, `distance` — each 0–1, **default 0.5**.

v1 always creates at 0.5 and does not change session math yet. Directory `list_minds` / `describe_mind` return the values so we can compare clones later. `set_temperament` exists. No requirement to wire sliders into `decideBrief` until we come back to it.

Same core, different temperament = two Minds, two DOs. They do not communicate.

## Surfaces

**Gallery** `GET /` — public list from Directory (name, slug, core summary, status). No family-hub copy in the shell.

**Public Mind** `GET /minds/:slug` — graph, thought list, sessions (brief + outcome labeled), lineages including unrelated/parked, expand children linked to origin session, published notes. Read-only.

**Operator Mind** `GET /minds/:slug/op` — token. One compose box, three verbs: Queue, Force, Talk. Pause/resume wakes, inbox, active brief, lineage retrieve.

**Directory chat** — token. Create Minds in language. Same tools from a thin create form so OSS users are not stuck if chat fails.

Inbound Think chat on a **Mind** is **Talk**, never “start a chat session.”

## Data

### Directory SQLite

`minds`: slug (PK), name, core_summary, temperament_json, status (`booting` | `live` | `archived`), created_at, archived_at.

No thoughts.

**Create:** serialize on the Directory. Reserve slug → `Mind.bootstrap(...)` → status `live`, or remain `booting` for retry. Slug unique.

### Mind SQLite

`identity`: slug, name, persona, core, temperament_json, paused, created_at.

`suggestions`: id, text, status (`queued` | `selected` | `dismissed`), created_at, lineage_id nullable.

`utterances`: id, lineage_id, text, created_at, consumed_at.

`lineages`: id, kind (`core` | `suggestion`), suggestion_id nullable, status (`relating` | `connected` | `exploring` | `unrelated` | `concluded` | `parked`), stashed_from_lineage_id nullable, dig_sessions, created_at, closed_at.

`sessions`: id, brief_type, lineage_id, started_at, ended_at, outcome nullable, thought_count.

`thoughts`: id, session_id, lineage_id, suggestion_id nullable, parent_id nullable, body, distance_to_core, created_at.

`agenda_items`: id, lineage_id, origin_session_id, origin_thought_id, text, status (`pending` | `active` | `done`).

Core lineage is created at bootstrap.

## Tools

**Mind (model):** `record_thought`, `set_outcome` (legal-only), `add_agenda_items`, `select_suggestion`, `ignore_inbox`, `set_wake`, `search_thoughts`, `publish_note`, `fetch_url`. Workspace file tools from Think (read/write/grep; bash is files-only, no network).

**Directory (model):** `create_mind`, `list_minds`, `archive_mind`, `describe_mind`, `set_temperament`.

**Operator RPC (not model tools):** `queue`, `force`, `talk`, `pause`, `resume`.

## Inference and cost

Workers AI only in v1. `getModel()` is a cheap hosted model (pin one in wrangler/env, not in topic code). Cloudflare dashboard daily limits are the spend cap. Optional local caution: if inference fails as rate-limited, set a later wake and hibernate.

Platform compute while hibernated is ~zero. The model bill is the cost.

## Public files

After each session the Mind writes at least `public/graph.json` and any `publish_note` markdown into the workspace (R2 spillover later if needed). The Worker serves public Mind routes from RPC and/or those files. Closed lineages stay in the graph.

## Error handling

- Bootstrap failure: Directory row stays `booting`; create is retryable; no duplicate slug.
- Illegal `set_outcome`: tool error, session continues.
- Model forgets `set_wake`: handler sets a default (idle interval).
- Alarm eviction / 15-minute wall: persist thoughts so far, outcome defaults to `continue_line` if missing, set next wake, exit.
- `fetch_url` failure: record as thought context, do not crash the session.
- SQLITE_FULL: stop writes, set a long wake, surface on operator UI.

## Testing

- `decideBrief` unit tests: force > talk > agenda > dig > relate > continue_line > inbox_glance > grow_frontier.
- Legal outcome matrix: reject illegal, accept legal.
- Queue does not call wake; force and talk do.
- Talk does not create a suggestion; force does.
- Unrelated closes lineage and restores stash.
- Expand writes agenda items linked to session; next brief is `pursue_agenda`.
- Isolation: Mind code has no `getAgentByName` to another Mind slug.

## Later (explicit)

- Temperament affecting caps and prompt bias.
- New Mind from another Mind’s export.
- Browser / Sandbox / BYO models via AI Gateway.
- Cloudflare Access.
- Cross-Mind comparison UI (read-only, still no chatter).
