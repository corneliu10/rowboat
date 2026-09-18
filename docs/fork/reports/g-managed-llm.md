# spike/g-managed-llm
Base: bfc6fcf4 · Tip: 3 commits on spike/g-managed-llm above bfc6fcf4 — subjects under Commits, tip sha via `git rev-parse spike/g-managed-llm` (sha omitted here: embedding it would change it)
## Commits
- 7f00cf85 lane G steps 1-2: static Spinrun bearer + managed-switch tests
- 72ce0239 lane G step 3: stub managed gateway + contract tests
- <tip> lane G steps 4-5: proof, 08-managed-llm.md, this report
## Tests
- typecheck: shared, core, server, client (`tsc --noEmit`), renderer (`tsc -b`) — all exit 0
- shared: 326 pass, 0 fail (21 files) · server: 27 pass, 0 fail (4 files) · renderer: 1021 pass, 0 fail (120 files)
- core targeted (lane G + neighbours): 54 pass, 0 fail (6 files: static-key 14, catalog-static-key 4, rowboat-selection-static-key 3, catalog, initial-selection, gateway)
- core full: 7 failed | 1015 passed | 13 skipped (90 files) — all 7 are baseline red/flaky, none in lane-G files: `chatgpt-auth.test.ts` ×3 (persistent `__vite_ssr_import_0__`), `catalog.test.ts` bundled-skills (persistent use-railway names), `status-tracker.test.ts` (persistent timeout), `orgs-session.test.ts` + `orgs-oauth.test.ts` hook timeouts (spaces load-flaky, cf. `docs/fork/00-baseline.md` §Red tests)
- stub contract `node --test tools/control-plane-stub/stub.test.mjs`: 13 pass, 0 fail, no live call (fake upstream in-test)
- `npm run rebrand:check`: exit 0
## Acceptance
| # | item (verbatim from the prompt) | pass / fail / blocked | evidence (a test name, a file:line, a number) |
|---|---|---|---|
| 1 | static-key tests | pass | `src/auth/static-key.test.ts` 14/14 (set/unset/wrong-prefix/empty/OAuth-alongside for `staticSpinrunKey`, `getAccessToken`, `isSignedIn`) |
| 2 | catalog/selection tests with the switch on | pass | `src/models/catalog-static-key.test.ts` 4/4 (lists `rowboat`/`Spinrun` with empty providers, hidden when off/signed-out/wrong-prefix); `src/models/rowboat-selection-static-key.test.ts` 3/3 (seeds from `GET /v1/llm/models` with static bearer, no-op when off, keeps saved choice); renderer guard `providers-section.tsx:305` untouched (`isRowboatConnected` true via catalog, no sign-in entry needed) |
| 3 | stub proxy tests, no live call | pass | `stub.test.mjs` 13/13 against fake upstream: auth, whitelist (`n`/`models`/`providerOptions`/`user` dropped, `reasoning` reduced, `max_tokens` capped), headers dropped, SSE identical, usage log, abort, models mapping, images 501, forced 401/402/429 |
| 4 | PONG + tool turn on the managed provider with the stub's usage log line pasted | pass | PONG `2026-09-18T11-16-28Z-0040133-000` → `turn_completed` `PONG.`, `lastModel {rowboat, google/gemini-2.5-flash-lite}`, wall ~5 s; stub `POST /v1/llm/chat/completions -> 200 upstream=5887ms usage prompt=153 completion=781 total=934` (plus `1684ms prompt=18051…` / `1113ms prompt=29134…` in the same turn); tool turn `2026-09-18T11-29-04Z-0040133-000` `executeMcpTool spinrun_list_apps` → `success:true` → 11 apps listed (airtable 14, brain 1, data 4, github 256, googleads 34, googledrive 11, metaads 32, n8n 19, pipedrive 20, posthog 36, strapi 11) |
| 5 | zero gateway-key hits in workdir and repo, no apiKey in models.json | pass | `grep -rlF` gateway key over `~/.spinrun-spike/g` + `~/Documents/rowboat-g` → none; `config/models.json` `{providers:{}, assistantModel:{rowboat, google/gemini-2.5-flash-lite}}`, no `apiKey` |
| 6 | lsof table showing which process talks to which host | pass | app `40133`: only `127.0.0.1` + `192.168.0.107→64.29.17.1:443` (MCP `spinrun.ai`); stub (`34806`/`95851`): only `127.0.0.1:4300` + `→64.239.123.65:443` / `→64.239.109.65:443` (`ai-gateway.vercel.sh`); `spinrun.ai→216.198.79.1,64.29.17.1`, `ai-gateway→64.239.109.65,64.239.123.65`; `~/.spinrun-spike/g/net-samples.log` 1033 lines |
| 7 | 401/402 user-visible texts recorded | pass | `402`: `Insufficient credits [status 402 — {"error":{"message":"Insufficient credits","type":"billing_error","code":"insufficient_credits"}}]`; `401`: `Invalid API key [status 401 — {"error":{"message":"Invalid API key","type":"authentication_error","code":"invalid_api_key"}}]` (verbatim `turn_failed.error`; stub `-> 402/401 upstream=0ms usage -` ×2 each) |
| 8 | 08-managed-llm.md written | pass | `docs/fork/08-managed-llm.md` (wire contract, `reasoning`-kept rationale, 401/402 texts, OAuth/Supabase + images + preflight follow-ups) |
| 9 | typecheck and tests green with counts, `npm run rebrand:check` exit 0 | pass | see Tests above; core full red baseline recorded, never fixed; rebrand exit 0 |
| 10 | report at docs/fork/reports/g-managed-llm.md | pass | this file |
| 11 | pushed, secret greps on the branch empty | pass | pushed to `origin/spike/g-managed-llm` only; `grep -F` both keys over `git log -p origin/spike/integration..` prints nothing (verified post-push) |
## Decisions
- `reasoning` kept (reduced to `effort`/`enabled`/`exclude`): C2 step 2b recorded ACCEPT (`thoughtsTokenCount:13`), so the stub does not drop it.
- Static `spr_…` bearer (spike-only): `SPINRUN_API_KEY` in the app env, `AI_GATEWAY_API_KEY` only in the stub env; MCP key reused as the desktop bearer per the lane (allowed in app env + workdir `mcp.json` only).
- Model `google/gemini-2.5-flash-lite` (live-listed, cheapest capable): Sonnets 403 on the spike key (C2); exact-shape coaching needed for `executeMcpTool` (`{serverName, toolName}` only); one unsteered app-navigation answer + two 429-hit turns kept as evidence; 5-minute spacing stayed green for the final PONG→tool pair.
- "Approved 2026-09-18 by Corneliu Dumitru, ISMS owner (founder): lane G may reuse the lane-C2 production Spinrun API key (workspace <slug>, read-only tool calls only, each approved explicitly) and the capped Vercel AI Gateway key `spinrun-desktop-spike` for at most ten one-sentence model turns. Both keys are revoked when the round ends." (Reuse of the C2 approval terms for lane G; total live turns used: PONG + 4 tool attempts + 2 forced-error turns = 7.)
## Not verified
- Visual check of any UI (headless lane by design); Harbor suites (untouched); whether Sonnet works on a paid-topped-up key (C2 403 evidence only); PostHog/`update.electronjs.org` absence beyond the sampled window (server 11:15–11:29Z, sampler covered it fully); second spinrun tool (discover→run) beyond `list_apps` (rate-limit budget kept for the required single tool turn).
## Shared files
Lane-0 file untouched; no `00-baseline.md` hunk needed (headless addendum from C2 already covers `sessions:create → sendMessage → getTurn` polling). No other shared files: `LICENSE`/`NOTICE` untouched, `POSTHOG_KEY`/`VITE_PUBLIC_POSTHOG_KEY` never set (`ROWBOAT_TELEMETRY=off` on every run).
