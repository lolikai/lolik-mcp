#!/usr/bin/env node
// ─── @lolikai/mcp — Lolik Trend Radar MCP server (npx-installable) ─────────────────
// Self-contained distribution of the MCP server: run it without cloning the repo,
//   npx @lolikai/mcp           → start the stdio server (for a Claude Desktop config)
//   npx @lolikai/mcp --config  → print a ready-to-paste Claude Desktop config block
//
// Mirrors scripts/mcp-server.mjs (the in-repo entry); the only difference is the
// import below points at the bundled ./tools.mjs so the package is standalone. The
// tool LOGIC stays single-sourced in lib/mcp/tools.mjs (this copy is drift-guarded
// by __tests__/mcp-package-sync.test.ts).
//
// Env: LOLIK_API_KEY (required) · LOLIK_API_BASE_URL (default https://lolikai.com)
// Every tool calls the public REST API with the key → auth + credits + rate-limit +
// cache-only are enforced server-side. No filesystem/debug tools.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TOOL_MANIFEST, CONTENT_BRAIN, runTool, runContentBrain } from "./tools.mjs";

// ── `--config` / `init`: print the Claude Desktop config and exit (no server) ──
if (process.argv.includes("--config") || process.argv.includes("init")) {
  const config = {
    mcpServers: {
      lolik: {
        command: "npx",
        args: ["-y", "@lolikai/mcp"],
        env: {
          LOLIK_API_KEY: "lk_live_your_key_here",
          LOLIK_API_BASE_URL: "https://lolikai.com",
        },
      },
    },
  };
  console.log("# Paste into Claude Desktop → Settings → Developer → Edit Config:");
  console.log("# Get your key at https://lolikai.com/account/api-keys (each tool call spends credits).");
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

const apiKey = process.env.LOLIK_API_KEY;
const baseUrl = process.env.LOLIK_API_BASE_URL || "https://lolikai.com";
if (!apiKey) {
  console.error("[lolik-mcp] LOLIK_API_KEY env is required — get one at https://lolikai.com/account/api-keys");
  console.error("[lolik-mcp] Tip: run `npx @lolikai/mcp --config` to print a Claude Desktop config block.");
  process.exit(1);
}
const ctx = { baseUrl, apiKey };

/** Build a Zod raw shape from a manifest's params metadata. */
function zodShape(params) {
  const shape = {};
  for (const [name, p] of Object.entries(params ?? {})) {
    let s = Array.isArray(p.enum) ? z.enum(p.enum) : z.string();
    s = s.describe(p.description || name);
    shape[name] = p.required ? s : s.optional();
  }
  return shape;
}

/** Wrap a tool-layer result as an MCP tool response. */
function toResult(res) {
  return {
    content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
    isError: !res.ok,
  };
}

const server = new McpServer({ name: "lolik-trend-radar", version: "0.1.0" });

for (const tool of TOOL_MANIFEST) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: zodShape(tool.params) },
    async (args) => toResult(await runTool(tool.name, args, ctx))
  );
}
server.registerTool(
  CONTENT_BRAIN.name,
  { description: CONTENT_BRAIN.description, inputSchema: zodShape(CONTENT_BRAIN.params) },
  async (args) => toResult(await runContentBrain(args, ctx))
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[lolik-mcp] connected via stdio · base=${baseUrl} · tools=${TOOL_MANIFEST.length + 1}`);
