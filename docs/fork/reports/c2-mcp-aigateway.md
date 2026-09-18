# spike/c2-mcp-aigateway
Base: ac9db197 · Tip: 3 commits on spike/c2-mcp-aigateway above bfc6fcf4, 6 files changed, 315 insertions(+) — subjects under Commits, tip sha via `git rev-parse spike/c2-mcp-aigateway` (sha omitted here: embedding it would change it)
## Commits
- b9f8ebbf lane C2 step 1: Spinrun MCP smoke script (step 1)
- f828ce93 lane C2 step 2: gateway wire fixtures (step 2/2b)
- <tip> lane C2 steps 3-8: spinrun-mcp doc, headless addendum, this report
## Tests
- typecheck: shared, core, server, client (`tsc --noEmit`), renderer (`tsc -b`) — all exit 0
- shared: 326 pass, 0 fail (21 files) · server: 27 pass, 0 fail (4 files) · renderer: 1021 pass, 0 fail (120 files)
- core: 1013 pass, 1 fail, 0 skipped (87 files) — the 1 fail is `src/runtime/tools/catalog.test.ts › bundled skills declare real builtin tools`, the red baseline recorded in `docs/fork/00-baseline.md` §Red tests (use-railway skill names); recorded, never fixed or omitted
- stub contract `node --test tools/control-plane-stub/stub.test.mjs`: not re-run (stub untouched); Harbor suites not run (harbor untouched)
## Acceptance
| # | item (verbatim from the prompt) | pass / fail / blocked | evidence (a test name, a file:line, a number) |
|---|---|---|---|
| 1 | smoke script output pasted (redacted), exit 0 | pass | `header-form: x-spinrun-key+client`, `tool-count: 24`, `spinrun_list_apps[0:500]` with 11 active apps; `tools/spinrun-mcp-smoke.mjs` |
| 2 | model id taken from the live list, and the three wire facts of step 2b recorded with the two fixture files committed and key-free | pass with deviation | id should have been `anthropic/claude-sonnet-5` (listed) but all Sonnets 403 on this key; fallback `google/gemini-2.5-flash-lite` from the live list. Facts: `reasoning` accepted (`thoughtsTokenCount:13`); chunk `id` prefix `gen_…`; `usage` keys (no cache-read/write names) — `docs/fork/fixtures/gateway-chat-stream.sse`, `docs/fork/fixtures/gateway-chat.json`, both grep-clean for both keys |
| 3 | PONG reply with model id, account backend = stub, no account/credits error | pass | turn `…10-18-55Z…` → `turn_completed`, output `PONG`, `sessions:list → lastModel {aigateway, google/gemini-2.5-flash-lite}`, wall ~5 s, usage 32319/8; `API_URL=http://127.0.0.1:4300` stub; zero error naming account/credits/billing/gateway |
| 4 | turn A made at least one spinrun tool call and answered from its result | pass | `executeMcpTool spinrun_list_apps` → `success:true` → answer lists all 11 apps (`…10-40-59Z…`); first unsteered try answered wrongly from `app-navigation`, recorded in `03-spinrun-mcp.md` |
| 5 | turn B outcome stated (works / does not, with the transcript) | works | discover `spinrun_app_github` → run `spinrun_run_tool GITHUB_ACTIVITY_LIST_REPO_S_STARRED_BY_AUTHENTICATED_USER` → answered starred repo `craft` (`…10-46-16Z…`); full tool-call/result log in `03-spinrun-mcp.md` |
| 6 | network table with zero hits on the three forbidden hosts | pass | 6 remote IPs, all Vercel `64.239/16` edge + `64.29.17.1` (MCP host `/24`); `api.x.rowboatlabs.com`, PostHog, `update.electronjs.org`: zero; `models.dev` never contacted; `~/.spinrun-spike/c2/net-samples.log` (604 lines, kept in workdir) |
| 7 | leakage result: only the two expected files | pass | `grep -rlF` both keys: only `~/.spinrun-spike/c2/config/mcp.json` + `config/models.json`; repo (tracked + staged), `server.log`, `stub.log`, fixtures: clean |
| 8 | 03-spinrun-mcp.md written and §Headless addendum added | pass | `docs/fork/03-spinrun-mcp.md` (new), `docs/fork/00-baseline.md` addendum hunk declared below |
| 9 | typecheck and tests green with counts | pass | see Tests above; core red baseline recorded |
| 10 | report at docs/fork/reports/c2-mcp-aigateway.md including the ISMS approval line for the production key | pass | this file; approval quoted verbatim under Decisions |
| 11 | pushed, both secret greps on `git log -p origin/spike/integration..` empty | pass | pushed to `origin/spike/c2-mcp-aigateway` only; `grep -F` both keys over the range prints nothing (verified post-push) |
## Decisions
- Model fallback: Sonnet 5/4.5/4 all `403 RestrictedModelsError` (free-tier team), so the lane ran on live-listed `google/gemini-2.5-flash-lite`; exact-shape coaching ("only these two keys") was needed for `executeMcpTool` args, and one unsteered turn is kept in the doc as evidence.
- Provider configured via the app's own RPC (`models:setProvider` + `models:updateConfig`), MCP server via the file `mcp/repo.ts` names (`config/mcp.json`); `mcp:listTools`/`mcp:executeTool` RPCs verified the app path independently of the agent.
- 5-minute spacing between model turns after hitting free-tier `429`s; no `402` seen; total gateway spend for the lane ≈ $0.0001 against balance $4.995.
- "Approved 2026-09-18 by Corneliu Dumitru, ISMS owner (founder): lane C2 may use one production Spinrun API key (workspace <slug>, read-only tool calls only, each approved explicitly) and the capped Vercel AI Gateway key `spinrun-desktop-spike` for at most ten one-sentence model turns. Both keys are revoked when the round ends."
## Not verified
- `screencapture`/visual check of any UI (headless lane by design); Harbor suites and stub contract test (both untouched); whether Sonnet works on a paid-topped-up key (403 evidence only for this key); `update.electronjs.org`/PostHog absence beyond the sampled window (server ran 10:18–10:55Z, sampler covered it fully).
## Shared files
Lane-0 file with a C2 hunk (nothing else edits it; `git log -- docs/fork/00-baseline.md` = lane 0 only):
```diff
--- a/docs/fork/00-baseline.md
+++ b/docs/fork/00-baseline.md
@@ §Headless — appended addendum 2026-09-18 (lane C2) @@
+### Addendum 2026-09-18 (lane C2): reading a turn headlessly
+(sessions:create → sessions:sendMessage → poll sessions:getTurn to
+turn_completed / turn_failed / tool_permission_required; answer with
+sessions:respondToPermission; model id from sessions:list lastModel;
+WS sessions:events alternative; see full text in the file.)
```
No other shared files: `LICENSE`/`NOTICE` untouched, no source hunks, no `POSTHOG_KEY`/`VITE_PUBLIC_POSTHOG_KEY` ever set (`ROWBOAT_TELEMETRY=off` on every run).
