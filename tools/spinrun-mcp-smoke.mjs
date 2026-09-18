#!/usr/bin/env node
// Step 1: MCP outside the app. StreamableHTTP client to $SPINRUN_MCP_URL.
// Never prints header values. Resolves the SDK from packages/core so the
// script runs from the repo root without hoisting.
import { createRequire } from "node:module";
const corePkg = new URL("../apps/x/packages/core/package.json", import.meta.url);
const req = createRequire(corePkg);
const { Client } = req("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = req(
  "@modelcontextprotocol/sdk/client/streamableHttp.js",
);

const url = process.env.SPINRUN_MCP_URL;
const key = process.env.SPINRUN_MCP_KEY;
if (!url || !key) {
  console.error("missing SPINRUN_MCP_URL or SPINRUN_MCP_KEY");
  process.exit(1);
}

async function tryConnect(headers, label) {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers },
  });
  const client = new Client({ name: "spinrun-smoke", version: "1.0.0" });
  await client.connect(transport);
  return { client, transport, label };
}

const forms = [
  [{ "x-spinrun-key": key, "x-spinrun-client": "spinrun-desktop" }, "x-spinrun-key+client"],
  [{ Authorization: `Bearer ${key}`, "x-spinrun-client": "spinrun-desktop" }, "bearer+client"],
  [{ "x-spinrun-key": key }, "x-spinrun-key-only"],
  [{ Authorization: `Bearer ${key}` }, "bearer-only"],
];

let connected = null;
let lastErr = null;
for (const [headers, label] of forms) {
  try {
    connected = await tryConnect(headers, label);
    console.log(`header-form: ${label}`);
    break;
  } catch (e) {
    lastErr = e;
    console.error(`header-form ${label} failed: ${e?.message ?? e}`);
    // Per plan: if the key header is rejected retry once with Bearer;
    // if the client header is rejected drop it. The ordered forms above
    // encode exactly that fallback chain.
  }
}
if (!connected) {
  console.error(`all header forms failed: ${lastErr?.message ?? lastErr}`);
  process.exit(1);
}

try {
  const { tools } = await connected.client.listTools();
  console.log(`tool-count: ${tools.length}`);
  for (const t of tools) console.log(`tool: ${t.name}`);
  const res = await connected.client.callTool({ name: "spinrun_list_apps", arguments: {} });
  const text = JSON.stringify(res);
  console.log(`spinrun_list_apps[0:500]: ${text.slice(0, 500)}`);
} catch (e) {
  console.error(`smoke failed: ${e?.message ?? e}`);
  process.exit(1);
} finally {
  try { await connected.client.close(); } catch {}
}
