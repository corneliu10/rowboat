# 08 — Managed LLM via Spinrun (lane G, 2026-09-18)

Branch `spike/g-managed-llm` from `origin/spike/integration` (`bfc6fcf4`).
Workdir `~/.spinrun-spike/g` (mode 700, outside every checkout). Server
`rowboat-server.cjs` headless on `127.0.0.1:54902` with
`ROWBOAT_WORKDIR=~/.spinrun-spike/g`, `ROWBOAT_TELEMETRY=off`,
`API_URL=http://127.0.0.1:4300` (control-plane stub),
`ROWBOAT_MANAGED_LLM=on`, `SPINRUN_API_KEY=spr_…` (the desktop bearer;
`AI_GATEWAY_API_KEY` UNSET for the app via `env -u`). The stub holds
`AI_GATEWAY_API_KEY` ONLY in its own environment — never in a file, never in
the app process. `SPINRUN_MCP_KEY` doubles as the desktop bearer and appears
only in the app env + `~/.spinrun-spike/g/config/mcp.json`.

Goal: reproduce Rowboat's original managed-gateway design with Spinrun in the
vendor's seat, locally. The desktop holds NO model key. It calls
`${API_URL}/v1/llm` with a Spinrun bearer; the stub stands in for Spinrun's
future endpoint and forwards to Vercel AI Gateway with the platform key.

Read first: `docs/fork/03-spinrun-mcp.md` (lane C2, in `rowboat-c2`);
`docs/fork/04-llm.md`; `docs/fork/01-control-plane.md`.

## Step 1 — the bearer

New `apps/x/packages/core/src/auth/static-key.ts` exporting
`staticSpinrunKey()`: the value of env `SPINRUN_API_KEY` when it starts with
`spr_`, else null. `getAccessToken()` (`auth/tokens.ts`) returns it first when
present; `isSignedIn()` (`account/account.ts`) is true when present. The OAuth
path stays intact and wins nothing over the static key in this spike;
`auth/oauth-flows.ts` untouched. Tests (`static-key.test.ts`, 14 tests): set /
unset / wrong prefix / empty / OAuth tokens present alongside (static wins,
OAuth fallback when absent).

## Step 2 — the switch

With `ROWBOAT_MANAGED_LLM=on` and a static key, the catalog lists the managed
provider (display name `Spinrun` via `providerDisplayName('rowboat')` and
`gateway.ts:listGatewayModels()` name `Spinrun`), `rowboat-selection` seeds the
assistant from `GET /v1/llm/models`, and no BYOK provider or `apiKey` is needed
in `config/models.json` (`resolveProviderConfig('rowboat')` returns
`{flavor:'rowboat'}` with no map entry; `setProvider` refuses `rowboat`/`codex`
as auth-derived). Tests: `catalog-static-key.test.ts` (4 tests: lists with
empty providers, hidden when switch off, hidden when signed out with no key,
wrong prefix ignored) and `rowboat-selection-static-key.test.ts` (3 tests:
seeds from `GET /v1/llm/models` with the static bearer, no-op when off, keeps a
saved choice). Renderer guard at `providers-section.tsx:305`
(`const managedLlmEnabled = false`) left as is — no sign-in entry is needed
when a static key is present because `isRowboatConnected` (catalog contains
`rowboat`) is already true, so `!isRowboatConnected && managedLlmEnabled` is
false.

Live proof used `assistantModel {provider:'rowboat',
model:'google/gemini-2.5-flash-lite'}` set via `models:updateConfig` (no
providers entry, no `apiKey`).

## Step 3 — the stub grows the gateway

`tools/control-plane-stub/server.mjs` (zero-dependency `node:http`), before the
404:

- `POST /v1/llm/chat/completions`: streaming pass-through to
  `${STUB_LLM_UPSTREAM:-https://ai-gateway.vercel.sh/v1}/chat/completions` with
  `Authorization: Bearer $AI_GATEWAY_API_KEY`. Requires incoming bearer
  starting with `spr_`, else 401
  `{error:{message:'Missing or invalid bearer token',type:'authentication_error',code:'unauthorized'}}`.
  Upstream body from the whitelist exactly as the real endpoint will: `model`,
  `messages`, `tools`, `tool_choice`, `parallel_tool_calls`, `temperature`,
  `top_p`, `frequency_penalty`, `presence_penalty`, `stop`, `seed`,
  `response_format`, `stream`, plus `reasoning` reduced to
  `effort`/`enabled`/`exclude`. Drops everything else (`models`, `provider`,
  `providerOptions`, `n`, `user`, …). `max_tokens = min(client or 8192, 8192)`.
  Forces `stream_options.include_usage=true` when `stream` is true. Drops every
  incoming `x-rowboat-*` and `authorization` header (upstream sees only
  `Content-Type` + platform `Authorization`). Pipes bytes byte-for-byte; aborts
  upstream when the client disconnects (via `res` close, not `req` close — `req`
  close fires normally after the body is read).
  NOTE on `reasoning`: lane C2 step 2b recorded the gateway ACCEPTS
  `reasoning` (`thoughtsTokenCount:13` in
  `docs/fork/fixtures/gateway-chat-stream.sse`), so the stub keeps the reduced
  form instead of dropping it.
- `GET /v1/llm/models`: requires `spr_` bearer else 401. With
  `?output_modalities=image` answers `{data:[]}` without upstream. Otherwise
  `GET ${STUB_LLM_UPSTREAM}/models` with the platform key, mapped to
  `{data:[{id}]}` language-models-only (keeps entries with no
  `architecture.output_modalities` or including `text`; drops image-only and
  malformed).
- `POST /v1/llm/images`: requires `spr_` bearer else 401; else 501
  `{error:{code:'not_implemented',message:'Image generation is not implemented
  in the spike stub',type:'invalid_request_error'}}`.
- `STUB_LLM_FORCE=401|402|429`: `chat/completions` answers that status with an
  OpenAI-style error and no upstream call (401 `Invalid API key /
  authentication_error / invalid_api_key`; 402 `Insufficient credits /
  billing_error / insufficient_credits`; 429 `Rate limit exceeded /
  rate_limit_error / rate_limit_exceeded`).
- One log line per request (`METHOD path -> status upstream=<ms>ms usage
  prompt=<n> completion=<n> total=<n>` or `usage -`); never a body, never a key.

Tests (`node --test tools/control-plane-stub/stub.test.mjs`, 13 tests, no live
call — fake upstream in-test): auth required (all three llm routes), whitelist
applied, headers dropped (upstream sees only platform key), SSE bytes identical
+ usage line logged without body/key, abort propagates (upstream `res` close),
models mapping (language-only, image empty without upstream), images 501,
forced statuses without upstream, plus the lane-A config/me/404 contract and a
pure `buildUpstreamChatBody` whitelist unit.

## Step 4 — proof (live)

Stub live (`AI_GATEWAY_API_KEY` in its env only). App headless as above
(`env -u AI_GATEWAY_API_KEY`).

(a) PONG on the managed provider: `sessions:create → sendMessage "Reply with
the single word PONG."` → `turn_completed`, output `PONG.`, `sessions:list →
lastModel {provider:'rowboat', model:'google/gemini-2.5-flash-lite'}`, wall
~5 s, app usage in 47185 / out 16. Stub lines (usage from final chunk):
`POST /v1/llm/chat/completions -> 200 upstream=1684ms usage prompt=18051
completion=13 total=18064`, `-> 200 upstream=1113ms usage prompt=29134
completion=3 total=29137`, `-> 200 upstream=5887ms usage prompt=153
completion=781 total=934` (three model calls in the turn: skill + command +
compose; the model ran allowlisted `executeCommand {"command":"echo PONG"}`).

(b) Spinrun tool turn (MCP config copied from lane C2:
`config/mcp.json` `{mcpServers:{spinrun:{url:<SPINRUN_MCP_URL>,
headers:{x-spinrun-key:spr_…, x-spinrun-client:spinrun-desktop}}}}`;
`mcp:listTools spinrun` → 24 tools including `spinrun_list_apps`): two turns in
one session after the 5-minute free-tier spacing. First loads `mcp-integration`
(empty answer, no 429). Second emits proper
`executeMcpTool {serverName:'spinrun', toolName:'spinrun_list_apps'}`
(`{kind:'mcp'}` ask → allowed) → `success:true` → answer lists all 11 apps
(airtable 14, brain 1, data 4, github 256, googleads 34, googledrive 11, metaads
32, n8n 19, pipedrive 20, posthog 36, strapi 11 — all `active`). Full
tool-call/result log in the lane report. Free-tier 429s were hit on fast
repeats (as in C2); 5-minute spacing stayed green for the final pair.

(c) Leakage: `grep -rlF` the gateway key over `~/.spinrun-spike/g` +
`~/Documents/rowboat-g` prints nothing; `config/models.json` is
`{version:2, providers:{}, assistantModel:{provider:'rowboat',
model:'google/gemini-2.5-flash-lite'}}` — no `apiKey`. The spinrun key appears
only in the app env + `config/mcp.json` (allowed).

(d) `lsof -a -p <pid> -iTCP -nP` (sampler every 3 s,
`~/.spinrun-spike/g/net-samples.log`, 1033 lines): app `40133` shows only
`127.0.0.1` (RPC `:54902`, stub `:4300`) plus `192.168.0.107:63271 →
64.29.17.1:443` during the tool turn; stub (`34806`/`95851`) shows only
`127.0.0.1:4300` plus `→ 64.239.123.65:443` / `→ 64.239.109.65:443` during
model turns. `ai-gateway.vercel.sh` resolves to `64.239.109.65,
64.239.123.65`; `spinrun.ai` resolves to `216.198.79.1, 64.29.17.1` (same
`/24` as C2's MCP host). I.e. the app talks only to loopback + `spinrun.ai`;
only the stub talks to `ai-gateway.vercel.sh`. No hits on
`api.x.rowboatlabs.com`, PostHog, or `update.electronjs.org` in the sampled
window.

(e) Forced error texts (verbatim `turn_failed.error` as surfaced by
`drive-turn.mjs`, via `STUB_LLM_FORCE` with no upstream call):
- `402`: `Insufficient credits [status 402 —
  {"error":{"message":"Insufficient credits","type":"billing_error","code":"insufficient_credits"}}]`
- `401`: `Invalid API key [status 401 —
  {"error":{"message":"Invalid API key","type":"authentication_error","code":"invalid_api_key"}}]`
Stub lines: `POST /v1/llm/chat/completions -> 402 upstream=0ms usage -` (×2),
`-> 401 upstream=0ms usage -` (×2).

## Wire contract a real Spinrun endpoint must satisfy

- Paths (all under `${API_URL}`): `POST /v1/llm/chat/completions`
  (OpenAI-compatible chat, streaming SSE when `stream:true`), `GET
  /v1/llm/models` → `{data:[{id}]}` (bare ids; language models only),
  `GET /v1/llm/models?output_modalities=image` → `{data:[]}` (until images
  exist), `POST /v1/llm/images` → `501
  {error:{code:'not_implemented',…}}` (until implemented).
- Request headers: `Authorization: Bearer spr_…` required (else 401
  OpenAI-style). `x-rowboat-use-case / -sub-use-case / -agent-name` are sent by
  `authedFetch` today; the real endpoint must accept and ignore them (the stub
  drops them).
- Request body the client really sends (OpenRouter SDK via
  `getGatewayProvider()`): whitelisted fields above; the bridge maps effort to
  `providerOptions.openrouter.reasoning.effort`, which the SDK renders as
  top-level `reasoning:{effort}`. The endpoint must accept `reasoning` with
  `effort`/`enabled`/`exclude` (gateway accepts it — C2 fixture), cap
  `max_tokens` at 8192, and honor `stream_options.include_usage` (the stub
  forces it; without it the final-chunk `usage` the stub logs and the app's
  billing need disappears).
- Transforms the stub needed (real endpoint must do the same or document
  otherwise): whitelist enforcement, `reasoning` reduction, `max_tokens` cap,
  `stream_options` forcing, header stripping, byte-identical SSE piping with
  abort propagation.
- Response shape: OpenAI chat SSE (`id: gen_…`, `object: chat.completion.chunk`,
  `delta`, final chunk carries `usage:{prompt_tokens, completion_tokens,
  total_tokens, cost, …}` with the C2 key set — no Anthropic cache-read/write
  names); non-stream JSON adds top-level `generationId` (=`id`). Errors are
  OpenAI-style `{error:{message, type, code}}` with HTTP 401/402/429 (texts
  above for 401/402; 429 free-tier text in the lane report).
- Auth for models/images is the same `spr_…` bearer (the app's
  `listGatewayModels`/`listGatewayImageModels` send it).

## Product follow-ups

1. OAuth instead of a static key: the app's existing PKCE + DCR flow already
   targets a Supabase Auth issuer read from `/v1/config` `supabaseUrl`, and
   Spinrun's Supabase Auth IS an OAuth authorization server — so the real
   endpoint can issue the `spr_…`-or-JWT bearer via the current dance with no
   new client auth code, replacing `SPINRUN_API_KEY` + `static-key.ts` (spike-only).
2. Image generation: `POST /v1/llm/images` + the `?output_modalities=image`
   allowlist are stubbed (`501` / `{data:[]}`); wire the real image backend and
   keep `ROWBOAT_IMAGE_MODEL` in sync.
3. Credit preflight UI: surface 402 (`insufficient_credits`) and 429
   (`rate_limit_exceeded`) distinctly in the thread (the spike surfaces the raw
   provider error text above); add balance/top-up entry points before the turn
   fails.
