# Minds

## What it is

Minds is an inner-monologue system, not a chatbot. Each Mind has its own persona and core, and independently reflects on queued topics.

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

## No inter-Mind chat

Minds do not chat with one another. Each Mind reflects independently.
