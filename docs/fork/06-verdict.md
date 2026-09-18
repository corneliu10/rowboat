# Spinrun Desktop spike: validation record and verdict (2026-09-17)

Run by Claude against the fork at `~/Documents/rowboat` (origin `corneliu10/rowboat`, upstream push
`DISABLED`). Every number below was produced fresh in the validation session; the lane reports' own
numbers are quoted only where they differ. Logs live outside the repo (Claude's scratchpad); the commands
are the ones in the plan's "My validation" section.

## Lane status

| Lane | Branch | On origin | Commits | Files | Report | Secret scan | LICENSE |
|---|---|---|---|---|---|---|---|
| 0 baseline | `spike/base` `ac9db197` | yes | 3 | docs + .gitignore | yes | clean | intact |
| A control plane | `spike/a-control-plane` `64b63b09` | yes | 2 | 5 (+372) | yes | clean | intact |
| B brand/updater/telemetry | `spike/b-brand-updater-telemetry` `c7dc860f` | yes | 7 | 27 (+619/−37) | yes | clean | intact |
| C spinrun MCP | `spike/c-spinrun-mcp` | **no** | **0** | 0 | **missing** | n/a | n/a |
| D LLM BYOK | `spike/d-llm-byok` `890e0806` | yes | 3 | 9 (+317/−5) | yes | clean | intact |
| E Harbor | `spike/e-harbor` `e490717f` | yes | 4 | 5 (+345) | yes | clean | intact |

**Lane C never ran.** Its worktree is byte-identical to `spike/base`. No `SPINRUN_MCP_URL`,
`SPINRUN_MCP_KEY` or `ANTHROPIC_API_KEY` exists in this session's environment either, which also blocks
plan steps 8 (end-to-end chat turn through a spinrun tool) and the chat half of step 9.

Ownership: every changed path is inside its lane's allowed set. Lane B's two shared-file hunks
(`packages/shared/src/index.ts`, `packages/shared/src/ipc.ts`) and lane D's one (`providers-section.tsx`)
are declared verbatim in the reports. Lane B's `pnpm-lock.yaml` churn comes from adding `vitest` to
`apps/main` so `updater.test.ts` can run; it is declared under Decisions, not Shared files.

## Fresh per-lane runs (typecheck 5/5 exit 0 on every lane)

| Lane | shared | core | server | renderer | extra |
|---|---|---|---|---|---|
| A | 321/321 | 978 pass, 1 fail | 27/27 | 1014/1014 | stub `node --test`: 3/3 |
| B | 321/321 | 1002 pass, 3 fail | 27/27 | 1019/1019 | `apps/main` vitest: 15/15 (3 files) |
| D | 321/321 | 1008 pass, 2 fail | 27/27 | 1014/1014 | switch tests inside core |
| E | 321/321 | 1001 pass, 1 fail | 27/27 | 1014/1014 | Harbor default parallelism: 369 pass, 13 skipped, 1 file PGlite hook timeout |

Core failures are the red baseline lane 0 recorded on a clean checkout, never a lane's file:
`runtime/tools/catalog.test.ts` (every lane; `use-railway` skill names tools not in `BuiltinTools`),
`auth/chatgpt-auth.test.ts` and `code-mode/sessions/status-tracker.test.ts` (B, D), `spaces/client.test.ts`
(A, load timeout). Baseline: 5 to 6 failing. Lanes D and E's `pnpm install --frozen-lockfile` exits 1 in
one second with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`: their `node_modules` were installed under the
lane's isolated pnpm store, so a plain reinstall wants to purge. Not a code problem; the integration build
reinstalls from clean with `CI=true`.

## Claims re-verified directly

- Packaged bundle from lane B: `Spinrun Desktop.app`, `CFBundleIdentifier ai.spinrun.desktop`,
  `CFBundleName Spinrun Desktop`, executable `spinrun-desktop`, 424 MB on disk (report said 463 MB), unsigned
  (`codesign` identifier `Electron`), as expected with signing skipped.
- Stub: `GET /v1/config` answers the four fields plus a `billing.plans` catalog that `RowboatApiConfig.parse()`
  requires (lane A's documented deviation); `GET /v1/me` answers an active `spike` plan with 1e12 credits;
  `/nope` is 404.
- Compose: `docker compose config` lists `postgres` and `harbor`; `.env.example` ships `AUTH_ISSUER=` empty.
- `brand.ts` holds the six values; `updater.ts` reads `brand.updateRepo` and reports `no-update-repo` when
  empty; no `rowboatlabs` literal in `updater.ts`.
- `managed.ts:18` `MANAGED_LLM_ENABLED` reads `ROWBOAT_MANAGED_LLM`, default off; the catalog gates on it;
  the renderer Add-provider hunk hardcodes `false`.
- Renderer "Rowboat" string count: 476, unchanged.
- The `file:line` claims sampled from all four reports resolve to the code they describe.
- Electron reopen-after-crash pref (`com.github.Electron ApplePersistenceIgnoreState = 1`) is set, so dev
  boots do not hang on this Mac.

## Integration (`spike/integration` = base + A + B + D + E, no conflicts, 46 files, +1653/−42)

- Install from clean (`CI=true`, purge + reinstall): exit 0, 153 s. Deps: exit 0, 38 s. Typecheck: shared,
  core, server, client, renderer, main all exit 0.
- Tests on the merge: shared 321/321 · core 994 pass, 6 fail, 13 skipped (the six are the baseline set:
  `chatgpt-auth` ×3 via `models/chatgpt-selection.ts:57`, a file no lane touched; `status-tracker`;
  `catalog`; load timeouts in `deck`, `orgs-oauth`, `orgs-session`) · server 27/27 · renderer 1019/1019 ·
  `apps/main` 5/5 · stub 3/3 · Harbor `--maxWorkers=2` 25 files, 381 pass, 1 skipped (S3 suite, no bucket).
- Package on the merge: exit 0, 89 s, 447 MB, `CFBundleIdentifier ai.spinrun.desktop`, `CFBundleName
  Spinrun Desktop`.
- Phone-home probe, run 1 (90 s): stub received 1 × `GET /v1/config` and 0 × `/v1/me`, so the `API_URL`
  redirect works and a signed-out app never asks for billing. Zero connections to `api.x.rowboatlabs.com`,
  PostHog or `update.electronjs.org`. One transient TLS connection to `172.217.171.170:443`
  (`*.1e100.net`, Google) during boot. Run 2 (60 s, same setup, process names captured): zero remote peers.
  The Google connection did not recur and could not be attributed to a process; candidates are Chromium
  itself or `electron-chrome-extensions`. Open item, not a control-plane call.
- No leftover processes after either run. Disk after everything: 12 GiB free.

## What the lanes answered

1. **Boots without Rowboat's servers.** Lane A: boot makes no backend call; with `API_URL` dead the only
   error is the OAuth sign-in path (`fetch failed`); with the stub, zero error lines in a 239-line log.
   Fifteen backend routes exist. Classification: STUB 4, DELETE 6, **REPLACE-WITH-SPINRUN 12**, KEEP 7.
   The three big replacements: LLM routing (`/v1/llm*`, catalog, image allowlist) **L**; auth session and
   sign-in (one Supabase session backs identity, gateway bearer, connectors, Spaces trust) **L**; Google
   backend-OAuth and picker (email, meetings, Drive ride it) **M**.
2. **Spinrun as MCP backend.** Not proven: lane C did not run. The code path needs no change (`{ url,
   headers }` is accepted, StreamableHTTP first), so this is a credentials gap, not a design gap.
3. **Control-plane size.** Two L items and one M item before Spinrun Desktop is a product; the rest is S.
4. **Rebrand cost.** One seam file, forge/package/menu/updater wiring, placeholder icons, NOTICE: 27 files.
   Eleven of them will conflict on every upstream sync (lane B's list in `docs/fork/02-upstream-sync.md`).
   Strict acceptance 3 fails on purpose: seven non-functional upstream links remain in frozen renderer copy,
   plus test fixtures and the mobile app id.
5. **Harbor self-host.** Dev mode works in memory; deployment mode refuses to boot without `AUTH_ISSUER`
   (`main.ts:99-103`). The consent flow is Supabase-Auth-specific by design (`consent.ts:9-11`), so
   spinrun's own Supabase project can be the issuer: pin `https://<ref>.supabase.co/auth/v1`, anon key as
   `AUTH_PUBLISHABLE_KEY`, Google or Microsoft enabled, `AUTH_AUDIENCE` unset. One issuer per deployment.
6. **LLM without an account.** The managed provider is hidden and never auto-selected with the switch off
   (8 tests). The BYOK turn itself was not run: no key. Keys live in plaintext `config/models.json`.

## Verdict: NO-GO for a product fork today, GO for a follow-up experiment with keys

Pass criteria were: integration steps 3, 7, 8, 9 green, and no L-sized REPLACE item without a spinrun
server-side equivalent. Step 8 could not run (no keys, lane C absent), so the criteria are not met and
"go" is not claimable on evidence. What the evidence does support:

- The codebase installs from clean, builds, typechecks, tests (only the pre-existing red baseline fails) and
  packages as `Spinrun Desktop` with the four lanes merged, and it runs with Rowboat's control plane
  replaced by a dependency-free stub while contacting none of the three phone-home hosts.
- The blocker to a product is the two L replacements: LLM routing and the auth session. Spinrun has server-side
  equivalents for both (AI Gateway routing, Supabase auth), so the criterion "no L item without an
  equivalent" holds. It is a build, not a research question.
- Upstream drift is the standing cost: 11 conflict-prone files today, before any control-plane work.

## Next steps

1. Lane C with credentials: export `SPINRUN_MCP_URL`, `SPINRUN_MCP_KEY`, `ANTHROPIC_API_KEY` in the shell
   profile, rerun the lane C prompt in a fresh OpenCode session, then rerun plan steps 8 and 9 on
   `spike/integration` (one chat turn through a spinrun tool, with `tcpdump` or `lsof` watching
   `api.x.rowboatlabs.com`, PostHog and `update.electronjs.org`). That is the missing half of the verdict.
2. Attribute the one boot-time connection to a Google address: run the sandbox with `lsof -p <electron pid>`
   sampled from the first second, or with `electron-chrome-extensions` disabled, and record which it was.
3. If the follow-up turns "go": a `Rowboat` row in conduit's `packages/clients` registry; the control-plane
   replacement (LLM routing and auth session, both L) as its own plan; the `rowboat://` scheme rename.


---

# Lane F: product-surface rebrand (validated 2026-09-18)

Branch `spike/f-rebrand` (17 commits: lane F 10, follow-up F2 7), merged here with `--no-ff`. Product "Spinrun",
assistant "Spinball", mention `@spinball`, deep link `spinrun://` (with `rowboat://` accepted for one release),
company "Spinrun", links to `spinrun.ai`. Internal identifiers deliberately kept (`ROWBOAT_*` env vars,
`~/.rowboat`, `@rowboat/*` package scope, `rowboat-server`, file names, IPC names, `x-rowboat-*` headers) so
upstream sync stays possible.

## Fresh runs on the final head (`b27b5b31`)

| Check | Result |
|---|---|
| Clean install, deps, typecheck ×6 + Harbor protocol/server | all exit 0 |
| shared / server / renderer / main / Harbor (`--maxWorkers=2`) / stub | 326, 27, 1021, 15, 381 + 1 skipped, 3/3 |
| core | 996 pass, 5 fail, 13 skipped; the five failing files are the baseline set (`chatgpt-auth`, `status-tracker`, `catalog`, `orgs-oauth`, `orgs-session`) |
| `npm run rebrand:check` | exit 0, now with a hard failure on any `rowboatlabs.com` URL |
| Independent greps (whole-word `rowboat`, capitalized `Rowboat`, `rowboatlabs.com`) | no user-visible copy left; remaining hits are identifiers, Harbor test emails, upstream engineering docs, the two sample-input fixtures |
| Secret scan, LICENSE, NOTICE | clean, byte-identical to `spike/base` |
| Bundle | `Spinrun.app`, `CFBundleName Spinrun`, `CFBundleIdentifier ai.spinrun.desktop`, executable `spinrun` |
| Logos | renderer, Chrome extension, mobile and installer GIF rasterized from `icons/spinrun-s.svg`; renderer logo md5 equals `icons/icon.png` and differs from upstream's |

## Mechanism

- `apps/x/packages/shared/src/brand.ts` holds twelve values plus `CODE_SESSION_BRANCH_PREFIX` and
  `MEETINGS_FOLDER`; `apps/harbor/packages/protocol/src/brand.ts` exports `MENTION_HANDLE` and
  `DEEP_LINK_SCHEME` for the wire, with `brand.test.ts` guarding against drift.
- Persona: `copilot/instructions.ts` builds "You are Spinball…" from `brand.assistantName`; snapshot regenerated.
- Mention: `shared/src/mention.ts` `mentionRegex(handle)` replaces every hardcoded `@rowboat` regex; Harbor
  parses and emits `[@spinball](#spinball)`; `Message.mentionsRowboat` keeps its name, value now Spinball.
- Defaults no longer point at Rowboat: `API_URL` → `https://api.spinrun.ai`, mobile `APEX_URL` →
  `https://spaces.spinrun.ai` (both dead until the control plane exists; the app boots and only the sign-in
  path errors, re-checked for two minutes with the stub off).
- Not migrated by design: stored notes and Spaces messages containing `@rowboat`, existing code-session
  branches named `rowboat/<id>`, existing `knowledge/Meetings/rowboat/` notes (the agent prompt reads both).

## Open items

1. `CFBundleDisplayName` is `spinrun` (lowercase) although `forge.config.cjs` sets it in `extendInfo`:
   `@electron/packager` 18.4.4 merges `extendInfo` in `updatePlistFiles` (`dist/mac.js:174`) and then
   `updatePlist` overwrites `CFBundleDisplayName` with the `executableName` (`dist/mac.js:90`). Fix: a forge
   `postPackage` hook running `plutil -replace CFBundleDisplayName -string Spinrun` on the bundle, or a
   capitalized `executableName`.
2. `google-setup.md` screenshots still show the previous UI (one line above them says so).
3. Same blockers as before: no screenshot (no display access from the agent session) and no full chat turn
   (no provider keys); lane C and plan steps 8 and 9 remain the missing half of the go/no-go.


---

# Lane C2: spinrun MCP + AI Gateway, the missing half of the go/no-go (validated 2026-09-18)

Branch `spike/c2-mcp-aigateway` (3 commits, docs + one smoke script, no source change), merged here.

## What ran, and what the reviewer re-ran

| Item | Lane result | Reviewer's own run |
|---|---|---|
| MCP outside the app | `tools/spinrun-mcp-smoke.mjs` exit 0, header form `x-spinrun-key` + `x-spinrun-client`, 24 tools | same: exit 0, 24 tools |
| Model turn on AI Gateway (built-in `aigateway` provider, control plane = stub) | `PONG`, `aigateway/google/gemini-2.5-flash-lite`, ~5 s | `turn_completed`, text `PONG` read from the persisted turn file, same model, 7 s |
| Spinrun tool turn | `spinrun_list_apps` after approval, answered with the 11 connected apps | not repeated (read-only production call; transcript in `03-spinrun-mcp.md`) |
| Discover then run | `spinrun_app_github` then `spinrun_run_tool`, answered from the result: works | not repeated |
| Phone-home during turns | 6 remote IPs, all Vercel edge or the MCP host; zero to Rowboat's API, PostHog, the updater | one peer during the turn, `64.239.109.193:443` = `ai-gateway.vercel.sh`; zero forbidden hosts |
| Key leakage | only `config/mcp.json` and `config/models.json` under the workdir | same two files; both key values absent from branch history, fixtures and the reviewer's logs |
| Build | typecheck 5/5; shared 326, server 27, renderer 1021; core 1013 + 1 baseline fail | typecheck 5/5; shared 326, server 27, renderer 1021; core 1008 pass, 6 fail in baseline or known load-flaky files; `rebrand:check` exit 0 |

## Updated verdict: GO for the experiment, product path gated on lanes G and H

Plan steps 8 (a real turn that calls a spinrun tool) and 9 (no contact with Rowboat's API, PostHog or the
updater while it runs) now pass, on top of steps 3 and 7. The pass criteria of the spike are met. What this
proves: the fork runs with Rowboat's control plane replaced by a stub, spinrun as its tool backend with no
code change, and spinrun's AI Gateway as its model path. What it does not prove yet: the managed design with
no model key on the desktop (lane G) and a metered spinrun endpoint behind it (lane H).

## Findings carried forward

1. **Gateway team.** The key `spinrun-desktop-spike` lives in the Vercel team `corneliu-0124032d` (free tier):
   every Anthropic Sonnet id answers `403 RestrictedModelsError`, so the turns ran on
   `google/gemini-2.5-flash-lite`. Before lane H's preview test, use a key from the team whose gateway
   spinrun's production bills to, or top this team up.
2. **Config file modes.** The app writes `config/models.json` and `config/mcp.json` as `0644` with plaintext
   keys. Only the `0700` spike workdir protected them here; the default `~/.rowboat` would not. Write them
   `0600` (small fix in the two repos' save paths) before anything ships.
3. **Approval line.** The ISMS approval quoted in `reports/c2-mcp-aigateway.md` still contains the literal
   `<slug>` placeholder for the workspace. The owner needs to fill it in; the key lists Airtable, Pipedrive,
   Google Ads and Meta Ads, which is not the QA workspace.
4. **Tool-argument shape.** On this small model the agent needed exact-shape coaching for `executeMcpTool`
   (`toolName`, not `name`); malformed arguments fail closed to a generic permission ask
   (`real-permission-checker.ts:88`), which is safe but opaque. Re-check on Sonnet.
5. **Static keys.** Rowboat's MCP client has no OAuth flow, so the `spr_` key sits in plaintext config.

## Wire facts for lane H (from `docs/fork/fixtures/`)

- Top-level `reasoning: {effort}` is accepted by `https://ai-gateway.vercel.sh/v1/chat/completions`.
- Stream chunk ids are `gen_…`, so the first chunk yields the generation id.
- Final `usage` keys: `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost`, `is_byok`,
  `prompt_tokens_details.{cached_tokens, audio_tokens, video_tokens}`. There is no cache-write field.
- An aborted generation does report usage through `GET /v1/generation?id=<gen id>`, so settlement by
  generation lookup after a client abort is viable.


---

# Lane G: the original managed-gateway design, locally (validated 2026-09-18)

Branch `spike/g-managed-llm` (3 commits), merged here. The desktop holds no model key: it calls
`${API_URL}/v1/llm` with a Spinrun bearer, and the control-plane stub forwards to Vercel AI Gateway with the
platform key held in the stub's environment only.

## What changed

- `auth/static-key.ts` `staticSpinrunKey()` reads env `SPINRUN_API_KEY` (must start with `spr_`);
  `auth/tokens.ts` `getAccessToken()` returns it first; `account/account.ts` `isSignedIn()` is true when it is
  present. `auth/oauth-flows.ts` untouched. Three hunks.
- With `ROWBOAT_MANAGED_LLM=on` the catalog lists the managed provider (shown as "Spinrun") and seeds the
  assistant model from `GET /v1/llm/models`; `config/models.json` needs no provider entry and no `apiKey`.
- `tools/control-plane-stub/server.mjs`: `POST /v1/llm/chat/completions` (body whitelist, `reasoning` reduced,
  `max_tokens` capped at 8192, `stream_options.include_usage` forced, incoming auth and `x-rowboat-*` headers
  dropped, bytes piped through, upstream aborted on client close), `GET /v1/llm/models`, `POST /v1/llm/images`
  → 501, `STUB_LLM_FORCE=401|402|429`. Binds to 127.0.0.1, logs one line per request, never a body or a key.
- `docs/fork/08-managed-llm.md` is the wire contract a real Spinrun endpoint has to satisfy.

## Reviewer's own runs

| Check | Result |
|---|---|
| Branch history | both real key values absent; the two pattern hits are fake fixtures in test files |
| Workdir | gateway key nowhere; `spr_` key only in `config/mcp.json`; `models.json` is `{providers:{}, assistantModel:{rowboat, …}}` with no `apiKey` |
| Process environments during the replay | gateway key present in the stub process, absent from the app process (`ps eww`) |
| PONG turn on the managed provider | `turn_completed`, text `PONG`, provider `rowboat`, 7 s |
| Connections during that turn | app: no remote peer; stub: `64.239.123.65:443` = `ai-gateway.vercel.sh` |
| Forced 402 | `turn_failed`, "Insufficient credits [status 402 …]", stub answered with zero upstream calls |
| Build | typecheck 5/5; shared 326, server 27, renderer 1021; core 90 files, 1011 pass, failures only in `catalog.test.ts` and `spaces/client.test.ts` (baseline); lane G's three new core test files 21/21 by name; stub 13/13; `rebrand:check` exit 0 |

## Findings

1. **Leftover processes.** The lane left its stub (with the gateway key in its environment, listening on
   127.0.0.1:4300) and its headless app server running after it reported completion. For about half an hour
   the stub was a local relay to the gateway key for any process presenting an `spr_`-prefixed bearer. The
   reviewer stopped both. The stub is a spike tool and must never be deployed or left running.
2. **Prompt weight.** One one-word turn produced four upstream calls carrying about 76k prompt tokens in
   total (18k to 29k per step: system prompt plus tool list, and a title call). On a Sonnet-class model that
   is a meaningful cost per trivial turn, so lane H's pricing has to assume prompt caching works end to end
   (`cache_control` is sent by the client; the gateway reports `prompt_tokens_details.cached_tokens`).
3. **Where the bearer goes.** Every consumer of `getAccessToken()` builds its URL from `API_URL` (billing,
   credits, Composio, web search, voice, Google backend OAuth, the LLM gateway); voice also uses
   `websocketApiUrl` from the remote config the same backend serves. So the `spr_` key is sent to whatever
   `API_URL` names, and nowhere else. A `desktop`-kind key (lane H) is what bounds that.
4. **Static key is a spike device.** The product path is OAuth: the app's existing PKCE + DCR flow already
   targets a Supabase Auth issuer read from `/v1/config`, and spinrun's Supabase Auth is an OAuth server.
5. Still on the free-tier gateway team, so the model was `google/gemini-2.5-flash-lite`; Sonnet untested.


---

# Lane H: the real metered `/v1/llm` endpoint in the spinrun monorepo (reviewed 2026-09-18)

Lives in the spinrun repo, not here: branch `feat/llm-proxy` at `38be389d`, pushed, no PR, not merged, not
deployed, migration written and never applied. Recorded here because it is the last gate of this verdict.

## What it is

`POST /v1/llm/chat/completions`, `GET /v1/llm/models`, `POST /v1/llm/images` (501) in the web app, satisfying
`08-managed-llm.md`. Pass-through to Vercel AI Gateway with the platform key; a new API-key kind `desktop` is
the only credential that may spend; catalog, plan and zero-data-retention gate; credits reserved before the
upstream call and settled exactly once (streamed usage, or a generation lookup when usage is incomplete or
the client aborted); a settings card mints and revokes the desktop key.

## Review result

- Fresh, uncached: 16/16 test tasks (web 1410, gateway 762, agents-runtime 641, providers 575, agent 322,
  zero failures), typecheck 17/17, migration version check clean, lane test files 31/31 by name.
- First review found two medium issues (body buffered before rate limit and auth; internal error text in two
  503s and a revoked-key race answering 503 instead of the identical 401) and five small ones. All seven were
  fixed in a follow-up, each with a named test, and re-verified by reading the code.
- Left as notes: the 413 from the capped body reader lacks `x-request-id`; the scope-refusal error keys on
  Postgres `42501`, so an RPC permission misconfiguration would also read as "Invalid API key" (the log line
  still shows the key id).

## What still stands between this and "go" for the product

1. Owner: validate the migration on staging inside a rolled-back transaction (the DO block must find the old
   CHECK), apply it, deploy the branch to a preview with `AI_GATEWAY_API_KEY` from the team production bills to.
2. Mint a desktop key on the new settings card; run one turn from this fork's managed provider against the
   preview (`API_URL=<preview origin>`, stub off); confirm the `agent_model_usage` row (`feature = 'llm-proxy'`,
   key id set, settled), the credit delta, and that an ordinary `spr_` key gets the 401.
3. Live checks only a deployment can answer: SSE not buffered on the domain, `request.signal` firing on client
   disconnect, and whether Anthropic streams report cache-write tokens (the fixture was a Gemini stream; until
   then every request carrying `cache_control` settles through the generation lookup).
4. Decisions for the owner: any plan, including free, can mint a desktop key; desktop keys do not expire and
   also authenticate on the MCP endpoint with the owner's reach.


## Lane H3 (2026-09-18): billing simplified to check, call, charge

Owner decision: v1 of `/v1/llm` does not reserve credits. Branch `feat/llm-proxy` is now at `f10c42a2`; the
reviewed reserve-then-settle version is kept as tag `llm-proxy-reserve-settle` (`38be389d`).

- Before the call: if the workspace cannot fit one credit, 402 and no upstream call. After the call: one
  charge of the real cost, taken from the gateway's `usage.cost`, else from the generation lookup
  (`totalCost`, retried for about fifteen seconds), else from the catalog price table. Converted with the
  existing billing config (FX, markup, price of a credit), rounded up, one-credit floor.
- The migration is two additive statements: key kind `desktop` allowed, and a `credit_rates` row
  `llm_proxy` at one credit per unit. No SQL function is replaced; `usage-billing.ts` and `usage-pricing.ts`
  are byte-identical to main, so production agent billing is untouched.
- Accepted trade-offs: bounded overrun by calls already in flight when credits run out; a call is unbilled
  if the process dies between answer and charge, or if a very long stream leaves too little of the 300 s
  ceiling for the lookup (logged with its generation id, reconcilable from AI Gateway reporting); desktop
  usage shows in the monthly credit total, not as its own line in the per-kind breakdown or the per-model ledger.
- Reviewer's fresh run: 16/16 test tasks (web 1412, agent 321, gateway 762, agents-runtime 641, zero
  failures), typecheck 17/17, lane files 40/40 and 29/29 by name, twelve billing tests covering pre-check,
  unlimited plans, stream and non-stream charge, abort via lookup, lookup failure, price-table fallback,
  failed charge RPC, and no charge on upstream errors. SDK type checked: `totalCost` and `usage` are both USD.
- Owner steps now: dry-run and apply the two-statement migration, mint a desktop key, run one managed turn
  from this fork against the endpoint, check the credit delta; confirm `usage.cost` on an Anthropic stream.
