/* ============================================================
   worker.js — thin, hardened relay between the TravelPlanner PWA
   and the Anthropic API.

   Why this exists: browsers cannot call api.anthropic.com directly —
   Anthropic's CORS policy only allows requests from their own console
   (confirmed by testing: only https://platform.claude.com gets an
   Access-Control-Allow-Origin back). This Worker is the minimum
   piece of server-side compute needed to bridge that gap. Your
   Anthropic API key lives ONLY here (as a Worker secret) — it is
   never sent to, or stored in, the browser.

   Hardening applied (because this URL is called from public,
   client-side JS, so anyone who finds it could otherwise hit your
   Anthropic account on your dime):
     1. CORS is locked to an explicit origin allowlist (ALLOWED_ORIGINS).
     2. The request is rewritten server-side, not passed through
        verbatim — model is pinned, max_tokens is capped, and only a
        small allowed set of top-level fields is forwarded. A caller
        cannot swap in a pricier model or an unbounded max_tokens.
     3. Only POST /v1/messages-shaped requests are relayed — nothing
        else proxies through this Worker.
   This does NOT fully stop abuse from a non-browser client that
   ignores CORS (e.g. curl) — CORS only constrains browsers. For a
   personal app this is an acceptable residual risk; see the README
   in this folder for a stricter option (a shared app-level secret).
   ============================================================ */

const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Hard caps enforced regardless of what the client asks for.
const ALLOWED_MODEL = "claude-haiku-4-5";
const MAX_TOKENS_CAP = 4096;

function corsHeaders(origin, allowedOrigins) {
  const allowed = allowedOrigins.includes(origin);
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigins = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!allowedOrigins.includes(origin)) {
      return jsonResponse({ error: "origin not allowed" }, 403, cors);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "method not allowed" }, 405, cors);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: "server not configured (missing ANTHROPIC_API_KEY secret)" }, 500, cors);
    }

    let incoming;
    try {
      incoming = await request.json();
    } catch {
      return jsonResponse({ error: "invalid JSON body" }, 400, cors);
    }

    // Rebuild the Anthropic request from scratch — never forward the
    // client body verbatim. Only these fields are honored.
    const outbound = {
      model: ALLOWED_MODEL,
      max_tokens: Math.min(Number(incoming.max_tokens) || 1024, MAX_TOKENS_CAP),
      messages: Array.isArray(incoming.messages) ? incoming.messages : [],
    };
    if (typeof incoming.system === "string") outbound.system = incoming.system;
    if (incoming.output_config && typeof incoming.output_config === "object") {
      outbound.output_config = incoming.output_config;
    }

    if (!outbound.messages.length) {
      return jsonResponse({ error: "messages[] is required" }, 400, cors);
    }

    let anthropicRes;
    try {
      anthropicRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(outbound),
      });
    } catch (err) {
      return jsonResponse({ error: "upstream request failed", detail: String(err) }, 502, cors);
    }

    const text = await anthropicRes.text();
    return new Response(text, {
      status: anthropicRes.status,
      headers: { "content-type": "application/json", ...cors },
    });
  },
};
