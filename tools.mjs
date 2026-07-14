// ─── Lolik MCP tool layer (Faza 1) ──────────────────────────────────────────────
// Declarative manifest + a generic HTTP wrapper that turns each /api/public/*
// endpoint into an MCP tool. The MCP server (scripts/mcp-server.mjs) is thin SDK
// wiring on top of this; this module holds all the logic and is unit-tested.
//
// Everything goes THROUGH the public REST layer (header `x-lolik-api-key`), so key
// auth + per-call credit debit + rate-limit + S0 (cache-only) are enforced exactly
// once, in one place. Tool descriptions are functional + opaque (S7): no data
// sources, no internal scoring logic.
//
// Plain ESM (no SDK / no TS imports) → importable by both the .mjs server and the
// vitest suite with an injected fetch.

/** One entry per tool. `params` = the query params the tool forwards (whitelist). */
export const TOOL_MANIFEST = [
  {
    name: "get_trends",
    path: "/api/public/trends",
    description: "Top trending topics for a niche. Returns title, source, niche, score, volume.",
    params: {
      niche: { description: "Filter to a niche, e.g. AI, Crypto, Tech, Finance, Business, Health.", required: false },
      source: { description: "Data source: 'google' (default) or 'youtube'.", required: false, enum: ["google", "youtube"] },
    },
  },
  {
    name: "virality_score",
    path: "/api/public/virality-score",
    description: "Virality score + breakout probability + hook type for a topic or title.",
    params: { q: { description: "Topic or title to score.", required: true } },
  },
  {
    name: "forecast",
    path: "/api/public/forecast",
    description: "Timing, momentum and lifecycle for a topic (rising vs peaking).",
    params: { q: { description: "Topic to forecast.", required: true } },
  },
  {
    name: "opportunities",
    path: "/api/public/opportunities",
    description: "Ranked opportunities for a niche, with possible monetization paths (estimates, not guarantees).",
    params: { niche: { description: "Filter to a niche.", required: false } },
  },
  {
    name: "prebreakout",
    path: "/api/public/prebreakout",
    description: "What's accelerating now, before it peaks — early-mover signal for a niche.",
    params: { niche: { description: "Filter to a niche.", required: false } },
  },
  {
    name: "get_brief",
    path: "/api/public/brief",
    description:
      "Daily what-to-post brief: phase-labeled pre-breakout alerts, measured outcome receipts, a validated pattern and the day's steepest mover. Drop-in replacement for a generic 'research trending topics' step in content pipelines.",
    params: { niche: { description: "Filter to a niche.", required: false } },
  },
  {
    name: "get_viral_patterns",
    path: "/api/public/viral-patterns",
    description: "Validated viral patterns (hook / structure) confirmed over time — what's working now, with evidence.",
    params: {},
  },
  {
    name: "rescue_hooks",
    path: "/api/public/hook-rescue",
    description:
      "Hooks for a topic, anchored in the title patterns currently validated across creators (live measured data, not a static list). Hook text is AI-drafted; the proof next to each hook (creators, days, strength) is measured. 5 credits.",
    params: { topic: { description: "Your topic or working title (4-120 chars).", required: true } },
  },
  {
    name: "grade_draft",
    path: "/api/public/grade",
    description:
      "Grade a draft title/hook against the patterns currently validated in live data — this week's data, not a static rubric. Score math runs in code; every component states its basis (measured / ai_judged / rule). Includes up to 2 rewrites with measured proof. 5 credits.",
    params: { draft: { description: "Your draft title or hook (4-200 chars).", required: true } },
  },
  {
    name: "get_news",
    path: "/api/public/news",
    description: "Freshest news stories, optionally for a topic.",
    params: { topic: { description: "Filter to a topic.", required: false } },
  },
  {
    name: "get_usage",
    path: "/api/public/usage",
    description: "Credits remaining + rate-limit status for your API key. Free (no credit cost).",
    params: {},
  },
];

export function getToolSpec(name) {
  return TOOL_MANIFEST.find((t) => t.name === name) ?? null;
}

/** Build a public-API URL from a path + only the whitelisted, present args. */
export function buildUrl(baseUrl, path, args, allowedParams) {
  const url = new URL(path, baseUrl);
  for (const key of allowedParams) {
    const v = args?.[key];
    if (v !== undefined && v !== null && String(v).length > 0) {
      url.searchParams.set(key, String(v));
    }
  }
  return url.toString();
}

/**
 * Call one public endpoint with the API key. Returns
 * { ok, status, body } — never throws on a non-2xx (so 401/402/429 surface to the
 * agent as structured info rather than a crash).
 */
export async function callEndpoint(path, allowedParams, args, ctx) {
  const fetchImpl = ctx.fetchImpl ?? fetch;
  const url = buildUrl(ctx.baseUrl, path, args, allowedParams);
  try {
    const res = await fetchImpl(url, { headers: { "x-lolik-api-key": ctx.apiKey } });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: { error: "network_error", message: String(e?.message ?? e) } };
  }
}

/** Run a manifest tool by name. */
export async function runTool(name, args, ctx) {
  const spec = getToolSpec(name);
  if (!spec) return { ok: false, status: 0, body: { error: "unknown_tool", tool: name } };
  return callEndpoint(spec.path, Object.keys(spec.params), args, ctx);
}

/**
 * lolik_content_brain — the one-call brief: trends + opportunities + forecast for a
 * niche/topic in a single response (each sub-call still bills its own credits).
 */
export async function runContentBrain(args, ctx) {
  const niche = args?.niche;
  const topic = args?.q ?? args?.topic;
  const [trends, opportunities, forecast] = await Promise.all([
    callEndpoint("/api/public/trends", ["niche", "source"], { niche }, ctx),
    callEndpoint("/api/public/opportunities", ["niche"], { niche }, ctx),
    topic
      ? callEndpoint("/api/public/forecast", ["q"], { q: topic }, ctx)
      : Promise.resolve({ ok: true, status: 200, body: { skipped: "no topic provided" } }),
  ]);
  return {
    ok: trends.ok && opportunities.ok,
    status: 200,
    body: {
      niche: niche ?? null,
      topic: topic ?? null,
      trends: trends.body,
      opportunities: opportunities.body,
      forecast: forecast.body,
    },
  };
}

export const CONTENT_BRAIN = {
  name: "lolik_content_brain",
  description:
    "One-call content brief for a niche: what's trending, the best opportunities (with possible monetization), and timing. Combines several signals.",
  params: {
    niche: { description: "Niche to brief, e.g. AI.", required: false },
    q: { description: "Optional specific topic to also forecast.", required: false },
  },
};
