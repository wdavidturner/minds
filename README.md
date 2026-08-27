# Minds

Minds is an inner-monologue system, not a chatbot. Each Mind has a persona and a **core** (the rail it keeps returning to). It ponders in multi-thought sessions, hibernates, wakes itself, and publishes a public graph of what it thought.

A human message does not start a session. It lands as an observation or a queued probe. The Mind decides whether that belongs on the core, and keeps thinking either way.

## Status: early alpha

This is **early-alpha software**. Expect breaking changes to routes, storage, prompts, and UI. Local and deployed Durable Object data may be wiped or become unreadable across deploys. Auth is a single shared operator token. There are no per-Mind ACLs, no production hardening, and no promise that a Mind will say anything useful.

Use it to experiment. Do not use it as a product, a system of record, or anything that needs to keep secrets safer than “whoever has the token.”

## Who it is for

Minds is for people who want a **persistent inner monologue on Cloudflare** — something that keeps a topic warm in the background while you live your life, then shows its work.

It is meant to be used by:

- **Operators** who create a handful of Minds, queue topics, talk into the stream, and pause when spend or noise is too high.
- **Tinkerers** who want Headlong-shaped persistent agency without standing up Headlong’s bash/`shellm`/Docker stack — Durable Objects, Think, and Workers AI instead.
- **Readers** of a public Mind page, who watch the thought graph, dead ends, and published notes. The public surface is read-only.

It is not meant to be used by end users as a chat app, by a team as shared memory, or by one Mind to debate another. Minds do not talk to each other.

A typical first Mind is personal and durable: a family hub, a research question, a project you want something to keep chewing on. The core is operator data, not code. The app does not hardcode those topics.

## Headlong

Minds exists because of [Headlong](https://github.com/laude-institute/headlong) ([Laude Institute](https://www.laude.org/updates/headlong-a-microharness-for-persistent-agents)).

Headlong’s idea of **persistent agency** is the point: the agent keeps thinking between external interactions, in a self-guided loop inspired by human inner monologue. A message from a human is one more observation in the thought stream, not the start of a turn. You give the agent a name and a personality; it keeps its own priorities.

That is the shape Minds is aiming at. If you want the real thing — never-asleep agency, recursive `shellm`, bash all the way down — run Headlong. This repo is not a port of Headlong or `shellm`. It is a Cloudflare experiment that borrows the philosophy and then does something smaller and different: isolated Minds, a core rail, hibernation between sessions, and a public thought graph.

Production is at [minds.intentionality.software](https://minds.intentionality.software).

## Deploy

Authenticate Wrangler, store the operator token as a secret, and deploy:

```sh
npx wrangler login
npx wrangler secret put OPERATOR_TOKEN
npm run deploy
```

The configured Workers AI model is `@cf/zai-org/glm-4.7-flash`. Each Mind can pick a different allowlisted model from the operator page, including GLM 5.3 Flash.

## Generate Wrangler types

Regenerate Cloudflare binding types after changing `wrangler.jsonc`:

```sh
npx wrangler types
```

## Create a Mind

Sign in as the operator, then create a Mind with the form at `/op/new` or ask the Directory chat to create one.

For example, a Mind's core text could be:

> Be a family hub: keep track of what matters to the family, connect related concerns, and surface useful next steps.

## Set Workers AI daily limits

Set Cloudflare Workers AI daily limits in the Cloudflare dashboard to control usage.

## Pause a Mind

Open the Mind's operator page and select **Pause**. A paused Mind stops processing queued thoughts until you select **Resume**.

## License

MIT. See [LICENSE](LICENSE).
