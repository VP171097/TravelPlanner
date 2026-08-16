# TravelPlanner AI proxy (Cloudflare Worker)

Anthropic's API only allows browser CORS requests from `platform.claude.com`
(confirmed by testing — every other origin, including a GitHub Pages site,
gets no `Access-Control-Allow-Origin` header and is blocked by the browser).
So a fully static, backend-free app **cannot** call Claude directly. This
Worker is the smallest possible piece of server-side compute that bridges
that gap: it holds your Anthropic API key as a secret and relays requests
from the PWA to `api.anthropic.com`, adding the CORS headers the browser
needs. Your key never touches the browser.

It's a **generic, deploy-once relay** — you don't need to redeploy it if you
change prompts or trip logic in the app; only the app's JS changes for that.

## Deploy it (one-time, ~2 minutes)

You'll need a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free
tier is enough) and an
[Anthropic API key](https://platform.claude.com/settings/keys).

```bash
cd cf-worker
npx wrangler login          # opens a browser to authorize your CF account
```

Edit `wrangler.toml` if your GitHub Pages URL isn't
`https://vp171097.github.io` — update `ALLOWED_ORIGINS` (comma-separate
multiple origins if you test locally too, e.g. add
`http://localhost:8000`).

```bash
npx wrangler secret put ANTHROPIC_API_KEY
# paste your sk-ant-... key when prompted — it's stored encrypted by
# Cloudflare and is never written to this repo or wrangler.toml

npx wrangler deploy
```

Wrangler prints your Worker's URL, something like:

```
https://travelplanner-ai-proxy.<your-subdomain>.workers.dev
```

## Point the app at it

Open the deployed TravelPlanner app → **Trips** tab → **🤖 AI settings** →
paste that URL in. It's saved in your browser's `localStorage` — the app
calls it only when you use "✨ AI regenerate"; everything else still works
exactly as before with zero network calls.

## Cost & abuse notes

- The Worker pins the model to `claude-haiku-4-5` and caps `max_tokens`
  server-side — a caller can't swap in a pricier model or an unbounded
  response size, no matter what the client sends.
- CORS is restricted to the origins you list in `ALLOWED_ORIGINS`, which
  stops other websites' JS from calling your Worker from a browser. It does
  **not** stop a non-browser client (curl, a script) that ignores CORS from
  calling the Worker URL directly if they discover it — CORS is a
  browser-side protection only. For a personal app this residual risk is
  usually fine; Cloudflare's free tier also gives you request analytics on
  the Worker's dashboard page if you want to keep an eye on it. For
  stronger protection, add a shared secret the app sends as a header and
  the Worker checks before forwarding (a few extra lines in `worker.js`),
  or set up a Cloudflare rate-limiting rule on the route.
- Cloudflare Workers free tier: 100,000 requests/day — far more than a
  personal trip planner will ever use.

## Redeploying after changes

```bash
cd cf-worker
npx wrangler deploy
```

No need to touch the secret again unless you're rotating the key.
