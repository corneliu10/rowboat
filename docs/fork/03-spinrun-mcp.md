# 03 — Spinrun MCP + AI Gateway lane (C2, 2026-09-18)

Branch `spike/c2-mcp-aigateway` from `origin/spike/integration` (`bfc6fcf4`).
Workdir `~/.spinrun-spike/c2` (mode 700, outside every checkout). Server
`rowboat-server.cjs` headless on `127.0.0.1:54901` with
`ROWBOAT_WORKDIR=~/.spinrun-spike/c2`, `ROWBOAT_TELEMETRY=off`,
`API_URL=http://127.0.0.1:4300` (control-plane stub). No source changes in
this lane; new files only: `tools/spinrun-mcp-smoke.mjs`,
`docs/fork/fixtures/gateway-chat-stream.sse`,
`docs/fork/fixtures/gateway-chat.json`, this file, the §Headless addendum in
`docs/fork/00-baseline.md`, and `docs/fork/reports/c2-mcp-aigateway.md`.
The turn driver `drive-turn.mjs` lives in the spike workdir, not the repo.

## Working config (keys redacted)

`~/.spinrun-spike/c2/config/mcp.json` (schema `McpServerConfig`,
`apps/x/packages/shared/src/mcp.ts:18-20`; repo path
`apps/x/packages/core/src/mcp/repo.ts:18`):

```json
{ "mcpServers": { "spinrun": {
  "url": "<SPINRUN_MCP_URL>",
  "headers": { "x-spinrun-key": "spr_…", "x-spinrun-client": "spinrun-desktop" }
} } }
```

`~/.spinrun-spike/c2/config/models.json` (`LlmModelConfig` v2,
`apps/x/packages/shared/src/models.ts:88-109`), written through the app's own
RPC (`models:setProvider`, `models:updateConfig` in
`apps/x/apps/server/src/core-deps.ts:1052-1066`), not by hand:

```json
{ "version": 2,
  "providers": { "aigateway": { "flavor": "aigateway", "apiKey": "gw_…" } },
  "assistantModel": { "provider": "aigateway", "model": "google/gemini-2.5-flash-lite" } }
```

`baseURL` omitted: `catalog.ts:152-154` applies
`AIGATEWAY_DEFAULT_BASE_URL = "https://ai-gateway.vercel.sh/v1"`.

## Header form that worked

First form tried, exit 0, no fallback needed:
`{ "x-spinrun-key": <key>, "x-spinrun-client": "spinrun-desktop" }`
(`StreamableHTTPClientTransport` first, `apps/x/packages/core/src/mcp/mcp.ts:77-79`).
Fallback chain in the smoke script (never reached): `Authorization: Bearer`,
then drop `x-spinrun-client`.

## Tool count

`tools/list` → **24 tools**, including `spinrun_list_apps`,
`spinrun_search_tools`, `spinrun_get_tool_schemas`,
`spinrun_get_connection_context`, `spinrun_app_github` (256 tools),
`spinrun_app_airtable` (14), `spinrun_run_tool`, and eight `spinrun_app_*`
discovery tools. `spinrun_list_apps {}` → 11 apps, all `active`: airtable,
brain, data, github, googleads, googledrive, metaads, n8n, pipedrive, posthog,
strapi.

## Model selection (deviation, documented)

Live list (`/v1/models | grep '^anthropic/claude-sonnet'`) returns
`anthropic/claude-sonnet-4`, `-4.5`, `-4.6`, `-5`. Per the lane,
`anthropic/claude-sonnet-5` was tried first — and all three Sonnets answer
`403 RestrictedModelsError` ("Free tier users do not have access to this
model") on the `spinrun-desktop-spike` key (`GET /v1/credits` at the time:
balance `4.99503302`, used `0.00496746`; free-tier team, no paid top-up).
Fallback, still taken from the live list (tool-use tag, cheapest capable):
**`google/gemini-2.5-flash-lite`** (probe `stream:false`, max_tokens 16,
"Say OK." → `200`, `"OK."`, `id: gen_01M2…`). Everything below runs on it.

## Gateway wire facts (step 2b, max_tokens 16, "Say OK.")

- (a) `stream:true` + `stream_options:{include_usage:true}` +
  `reasoning:{effort:"low"}` → `200`; **`reasoning` accepted** (chunk carries
  `delta.reasoning` + `reasoning_details`, `thoughtsTokenCount: 13`). Chunk
  `id` prefix **`gen_…`** (`gen_01M2SZZB8DHPP2BQKXXV0TT7M7`). Thinking ate the
  whole budget → no content delta, `finish_reason: "length"`. Saved to
  `docs/fork/fixtures/gateway-chat-stream.sse`.
- Final SSE `usage` keys (no Anthropic cache-read/write names anywhere):
  `prompt_tokens, completion_tokens, total_tokens, cost, is_byok,`
  `prompt_tokens_details{cached_tokens, audio_tokens, video_tokens},`
  `cost_details{upstream_inference_cost, upstream_inference_prompt_cost,`
  `upstream_inference_completions_cost},`
  `completion_tokens_details{reasoning_tokens, image_tokens},`
  `cache_creation_input_tokens, market_cost, gateway_cost`.
  Non-stream (b) adds top-level `generationId` (= `id`) and
  `message{reasoning, reasoning_details}`; same usage keys. Saved to
  `docs/fork/fixtures/gateway-chat.json`.
- (c) `curl … | head -n 2` abort → `gen_01M2T09G63VANZKNBQ8V170YYZ`; after
  60 s `GET /v1/generation?id=…` (path from
  `vercel.com/docs/ai-gateway/sdks-and-apis/rest-api`, never guessed) answers
  **`tokens_prompt: 3, tokens_completion: 1, native_tokens_reasoning: 11`,
  cost `0.0000051`, `finish_reason: "length"` — an aborted generation DOES
  report (and bill) token usage.**
- Free-tier throttle seen twice (`429 RateLimitExceededError` on fast
  repeats, incl. one app turn that failed after its 3 internal attempts);
  5-minute spacing between turns stayed green. No `402` ever appeared.

## Turns (agent `copilot`, headless server, reply read via
`POST /rpc/sessions:getTurn {turnId}` polling — see §Headless addendum)

PONG (`sessions:create` → `…/10-18-53Z…`, `sessions:sendMessage`,
"Reply with the single word PONG."): `turn_completed`, output **`PONG`**,
app-reported model `sessions:list → lastModel {provider: "aigateway",
model: "google/gemini-2.5-flash-lite"}`, wall ~5 s, usage in 32319 / out 8,
no account/credits/billing/gateway error. (The model ran allowlisted
`executeCommand {"command":"echo PONG"}` and quoted its stdout.)

Turn A ("Which apps are connected in my Spinrun workspace? Use the spinrun
tools."): first try answered from the local `app-navigation` skill
(`read-view apps → []`) with "no apps connected" — wrong, no spinrun call.
Steered retries showed the small model's arg-shape problem: twice it emitted
`executeMcpTool` with `name` instead of `toolName`
(`{"arguments":{…},"name":"spinrun_list_apps"}`), which fails
`McpExecuteInput.safeParse` in
`apps/x/packages/core/src/runtime/turns/bridges/real-permission-checker.ts:88`
and falls closed to a generic `{kind:"tool",
toolId:"builtin:executeMcpTool"}` ask (first denied: read-only intent but
malformed; second allowed: ran, `MCP error -32602: Missing tool name`). With
"only these two keys: toolName …, serverName …" it emitted
`{"serverName":"spinrun","toolName":"spinrun_list_apps"}` → proper
`{kind:"mcp", serverName:"spinrun", toolName:"spinrun_list_apps"}` ask →
allowed → `success:true` → final answer lists all 11 apps from the result.
**Two-step discover→run works in this loop, but only with exact-shape
prompting on this model.**

Turn B ("For the github app, … discovery … then run one read-only tool …"):
`executeMcpTool spinrun_app_github {task:"List all repositories"}` (kind:mcp,
allowed) → skill `get-authenticated-github-user-info-and-list-repositories-…`;
then `executeMcpTool spinrun_run_tool
{name:"GITHUB_ACTIVITY_LIST_REPO_S_STARRED_BY_AUTHENTICATED_USER"}` (kind:mcp,
allowed, read-only list) → `success:true` → answer names the starred repo
**craft by gustavo-fior** (114 stars). It picked "starred" rather than owned
repos — model choice, still read-only.

## Permission flow (as observed)

Ask surfaces as durable `tool_permission_required` (`turn_suspended`);
answered with `POST /rpc/sessions:respondToPermission
{turnId, toolCallId, decision}` (`allow`/`deny`) per
`apps/x/apps/server/src/core-deps.ts:176-179` → `tool_permission_resolved`,
turn resumes. `listMcpTools`/`listMcpServers` are `permission:"none"`
(`domains/mcp.ts:52,72`) and never ask; `executeMcpTool` is
`permission:"mcp-execute"` (`domains/mcp.ts:95`) and always asks (correct
shape → `{kind:"mcp",…}`, malformed → generic `{kind:"tool",…}`). Approved
4 read-only calls, denied 1 malformed call; every exchange is in the turn
transcripts above.

## Network (sampled every 3 s from PONG through turn B)

Remote peers of `node rowboat-server.cjs` (pid 25178), all `:443`:
`64.239.123.65` (= `ai-gateway.vercel.sh` A record) plus `64.239.109.1`,
`64.239.109.129`, `64.239.123.129`, `64.239.123.193` (same Vercel
`64.239/16` edge pool) and `64.29.17.1` (same `/24` as the MCP host, which
resolves to `64.29.17.65`; `models.dev` never contacted — the catalog served
from disk). **Zero** connections to `api.x.rowboatlabs.com`
(`216.150.1.1/16`), any PostHog host, or `update.electronjs.org`.
Remainder: localhost RPC.

## Leakage

`grep -rlF` both keys over workdir + checkout: exactly
`config/mcp.json` (MCP key) and `config/models.json` (gateway key) under
`~/.spinrun-spike/c2` — nothing in the repo (tracked or staged), nothing in
`server.log`/`stub.log`, fixtures key- and header-free.

## Gaps

1. Static long-lived keys in plaintext `mcp.json`/`models.json` — Rowboat's
   MCP client has no OAuth/token-refresh flow (`mcp.ts:71-79` forwards
   configured headers verbatim) and BYOK storage is plaintext by design
   (`docs/fork/04-llm.md`).
2. Lane-mandated Sonnet 5 unusable on this key (free-tier 403); the whole
   lane ran on gemini-2.5-flash-lite, which needs exact-shape coaching for
   `executeMcpTool` args and once answered from the wrong skill.
3. The approve/deny RPC cannot rewrite malformed args — deny only teaches via
   the error string, and this model gives up after one denial.
