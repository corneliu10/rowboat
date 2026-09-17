# spike/d-llm-byok
Base: `ac9db19765967c51b6409aee8c516638a116abf8` · Head: `6493874b` + this report commit (HEAD; `git log --oneline -3` to verify) · `git diff --stat spike/base...HEAD`: 8 files, +266/−5 before this report (+this file)
## Commits
- `698e3839` step Goal 2: add MANAGED_LLM_ENABLED switch (default off) hiding rowboat provider (step Goal 2)
- `6493874b` step Goal 4: add docs/fork/04-llm.md (provider keys, selection, switch, Spinrun) (step Goal 4)
- HEAD (this commit) step report: add docs/fork/reports/d-llm-byok.md (step report)
## Tests
- shared: 321 pass, 0 fail · core: 990 pass, 7 fail, 13 skipped (latest full run; earlier full run: 987 pass, 23 fail; targeted models files green, see evidence) · server: 27 pass, 0 fail · renderer: 1014 pass, 0 fail (rerun green; first full run: 1003 pass, 11 fail, load-flaky, see Not verified) · typecheck: pass (shared, core, server, client, renderer all exit 0)
## Acceptance
| # | item (verbatim from the prompt) | pass / fail / blocked | evidence (a test name, a file:line, a number) |
|---|---|---|---|
| 1 | (1) PONG reply recorded with model id, account unreachable | blocked | no turn attempted: `printenv ANTHROPIC_API_KEY \| wc -c` → `0`, `${#ANTHROPIC_API_KEY}` → `0` (empty, not exported); `docs/fork/img/04-*.png` absent; see Not verified |
| 2 | (2) switch tests for both values | pass | `catalog.test.ts` `MANAGED_LLM_ENABLED (ROWBOAT_MANAGED_LLM, default off)` (4 tests: env parsing, catalog on/off, image-catalog off) + `initial-selection.test.ts` `MANAGED_LLM_ENABLED switch (rowboat auto-select)` (4 tests: pick on/off, overrides off, BYOK fallback off); targeted `catalog+initial-selection` 30/30 pass, `catalog+initial-selection+gateway+repo` 40/40 pass |
| 3 | (3) with the switch off, the provider list the UI renders shows no managed entry (describe how you proved it) | pass | `catalog.test.ts` `when off, a signed-in user is NOT listed with the rowboat provider` (`getModelCatalog` → `['ollama']`, `listGatewayModels` not called) + `when off, the image catalog also hides the rowboat provider`; UI cards render `groups` straight from that catalog (`use-models.ts:93-108`, `providers-section.tsx:124-137`), and the Add dialog Rowboat entry is gated by the one-hunk guard (`providers-section.tsx:303-306`); no visual screenshot (no display), see Not verified |
| 4 | (4) 04-llm.md written | pass | `docs/fork/04-llm.md` (109 lines): `models.json`/`oauth.json`/`chatgpt-auth.json` paths + plaintext/keychain, selection files, `managed.ts:12,18` switch + 3 call sites, Spinrun touch list |
| 5 | (5) typecheck and tests green with counts | fail | typecheck 5/5 exit 0 (shared, core, server, client, renderer); tests NOT all green: core 7 failed / 990 passed / 13 skipped (latest; earlier 23 failed), renderer rerun 1014/1014 green after flaky first run 11 failed; reds listed in Not verified, none omitted |
| 6 | (6) report at docs/fork/reports/d-llm-byok.md | pass | this file |
| 7 | (7) pushed, no key in the diff | pass | `git push origin spike/d-llm-byok` (fork only; upstream push URL `DISABLED`); `git diff --cached \| grep -nE 'sk-ant-\|spr_[A-Za-z0-9_-]{16,}\|phc_[A-Za-z0-9]{20,}\|AKIA[0-9A-Z]{16}'` → `no-secret-patterns` before every commit |
## Decisions
- Switch shape: `export const MANAGED_LLM_ENABLED = (): boolean => ...` (`managed.ts:18`) — a callable const, not a static boolean, so `catalog.ts`/`rowboat-selection.ts`/`initial-selection.ts` read `ROWBOAT_MANAGED_LLM` live and tests can cover both values without module reloads; default `"off"` in this fork.
- Wrapper placement: blocked rowboat in core `initial-selection.ts` (wrapping `@x/shared`), not in shared — the renderer's BYOK connect flow imports shared directly and is unaffected; only the `"rowboat"` flavor short-circuits to `null`/`{}`.
- Renderer guard: hardcoded `const managedLlmEnabled = false` (`providers-section.tsx:305`) instead of a new IPC flag — one additive hunk, no server/auth changes (auth/* is do-not-touch), correct while the fork default is off; a Spinrun flag would wire a real value here.
- Harbor build: prompt's install line covers `apps/x` only, but core typecheck needs `@rowboat/harbor` dist — ran `apps/harbor` `pnpm install --frozen-lockfile` (13 s, exit 0) + `pnpm -r build` (protocol + server, exit 0) with the same lane isolation.
- Goal 1/3 stopped early per guard rails (no key → no fake turn, no screenshot, no gateway attempt); recorded under Not verified.
## Not verified
- PONG turn: blocked — `ANTHROPIC_API_KEY` empty (`printenv` 0 bytes, `${#VAR}` 0, not exported); no Anthropic provider added, no `claude-sonnet-4-6` pick, no reply text, no model id, no account/credits/billing/gateway error observed. Sandbox with `API_URL=http://127.0.0.1:1` not run (cannot produce the required PONG without a key).
- Screenshot `docs/fork/img/04-*.png`: absent — no display for Electron/screencapture in this session (baseline `00-boot.png` had the same blocker) and no key to drive the settings UI.
- AI Gateway path: not attempted, no key (`printenv AI_GATEWAY_API_KEY | wc -c` → `0`); `baseURL https://ai-gateway.vercel.sh/v1` + `aigateway` flavor plumbing documented in `04-llm.md` only.
- Visual proof of hidden provider: not screenshotted (no display); proved via unit tests + code path (catalog → `use-models` groups → cards; Add-entry guard) instead.
- Core reds (latest full run `7 failed | 79 passed (86 files)`, `7 failed | 990 passed | 13 skipped (1010)`): `src/auth/chatgpt-auth.test.ts > signOutChatGPT > best-effort revokes the refresh token (with client_id) then clears the store`; `> is a no-op-safe local clear when nothing is stored`; `> still clears the store when revocation fails` (persistent, `chatgpt-selection.ts:57` vite-ssr init, matches baseline); `src/code-mode/sessions/status-tracker.test.ts > CodeSessionStatusTracker projection > projects the shared machine…` (persistent); `src/knowledge/google-client-factory.test.ts > GoogleClientFactory.getClient > coalesces concurrent callers into a single refresh`; `src/runtime/tools/catalog.test.ts > bundled skills declare real builtin tools > every tool name a bundled skill attaches exists in BuiltinTools` (persistent, `use-railway -> Bash…`); `src/runtime/tools/domains/deck.test.ts > deck tools refuse to clobber a concurrent write > with no concurrent write…`; `src/spaces/orgs-oauth.test.ts` (suite); `src/spaces/orgs-session.test.ts` (suite). Earlier full run on same tip: `8 failed | 78 passed (86)`, `23 failed | 987 passed (1010)` (deck timeouts under load). Touched files green in isolation: `catalog+initial-selection` 30/30, `+gateway+repo` 40/40.
- Renderer first full run flaky reds (`4 failed | 114 passed (118)`, `11 failed | 1003 passed (1014)`, incl. `src/components/spaces/version-restore.test.tsx` timeouts); rerun green `118 passed (118)`, `1014 passed (1014)`; isolated `use-models+model-selection-section` 14/14 pass, `version-restore` 15/15 pass.
## Shared files
For each file another lane also edits, the hunk verbatim in a diff block.

```diff
diff --git a/apps/x/apps/renderer/src/components/settings/providers-section.tsx b/apps/x/apps/renderer/src/components/settings/providers-section.tsx
--- a/apps/x/apps/renderer/src/components/settings/providers-section.tsx
+++ b/apps/x/apps/renderer/src/components/settings/providers-section.tsx
@@ -300,7 +300,11 @@
   const chooseEntries = useMemo(() => {
     const entries: Array<{ id: string; name: string; tagline: string; icon: React.ElementType | null; onChoose: () => void }> = []
-    if (!isRowboatConnected) {
+    // Fork d-llm-byok: managed provider hidden (core models/managed.ts
+    // MANAGED_LLM_ENABLED() reads ROWBOAT_MANAGED_LLM, default "off") — the
+    // catalog never lists rowboat when off, so don't offer its sign-in here.
+    const managedLlmEnabled = false
+    if (!isRowboatConnected && managedLlmEnabled) {
       entries.push({
         id: "rowboat",
         name: "Rowboat",
```
