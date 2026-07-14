# @lolikai/mcp

The Lolik Trend Radar **MCP server** — live trend → money-ready intelligence as MCP tools
for Claude (Desktop / Code), Cursor and any MCP client. No repo clone, no build: run it with
`npx`. Every tool call uses your Lolik API key, so **auth, credits and rate limits apply** —
the same metered API as REST.

## 1. Get an API key (self-serve)
Sign in to Lolik → **[Account → API Keys](https://lolikai.com/account/api-keys)** → generate a key.
It's shown once (`lk_live_...`). Revoke any time. New accounts include free credits.

## 2. Run it
```bash
LOLIK_API_KEY=lk_live_xxx npx -y @lolikai/mcp
```
- `LOLIK_API_KEY` (required) — your key.
- `LOLIK_API_BASE_URL` (optional) — defaults to `https://lolikai.com`.

Print a ready-to-paste config block:
```bash
npx -y @lolikai/mcp --config
```

## 3. Add to Claude Desktop
Claude Desktop → Settings → Developer → Edit Config → paste:
```json
{
  "mcpServers": {
    "lolik": {
      "command": "npx",
      "args": ["-y", "@lolikai/mcp"],
      "env": {
        "LOLIK_API_KEY": "lk_live_your_key_here",
        "LOLIK_API_BASE_URL": "https://lolikai.com"
      }
    }
  }
}
```
Restart Claude Desktop — the Lolik tools appear. (Requires Node 18+.)

## Tools & credit cost
Each tool call spends credits from your Lolik wallet (one wallet across app + API + MCP),
exactly like the REST API:

| Tool | What it does | Cost |
|---|---|---|
| `get_trends` | Top trending topics by niche | 1 credit |
| `forecast` | Timing / momentum / lifecycle for a topic | 1 credit |
| `virality_score` | Virality score + breakout probability + hook type | 1 credit |
| `get_news` | Freshest news stories | 1 credit |
| `opportunities` | Ranked opportunities + possible monetization | 5 credits |
| `get_brief` | Daily what-to-post brief: phased alerts + receipts + pattern + mover | 5 credits |
| `rescue_hooks` | Hooks for your topic from live validated title patterns, with measured proof | 5 credits |
| `grade_draft` | Grade a draft title against this week's validated patterns (score math in code) | 5 credits |
| `prebreakout` | What's accelerating now, pre-peak | 5 credits |
| `get_viral_patterns` | Validated viral patterns (what's working now) | 5 credits |
| `get_usage` | Credits + rate-limit status | free |
| `lolik_content_brain` | One-call brief: trends + opportunities + forecast | 7 credits |

Monetization figures are estimates, not guarantees. Crypto content is educational, not financial advice.

## Links
- Developer docs: <https://lolikai.com/developers>
- API key dashboard: <https://lolikai.com/account/api-keys>
