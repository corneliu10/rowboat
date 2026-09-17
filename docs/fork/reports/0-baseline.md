# spike/base baseline
Base: `649a5f1bd12b53455e4f22a0221a4d51e12f8261` · Head: `244e6982` + this report commit (HEAD; `git log --oneline -3` to verify) · `git diff --stat 649a5f1b...HEAD`: 5 files changed, 288 insertions(+)
## Commits
- `0bbc1d31` step 7: isolate lane tool caches and runtime workdirs in .gitignore (step 7)
- `244e6982` step 7: add baseline docs (00-baseline.md, reports template, img/.gitkeep) (step 7)
- HEAD (this commit) step 8: add baseline report 0-baseline.md (step 8)
## Tests
- shared: 321 pass, 0 fail · core: 996–997 pass, 5–6 fail, 0 skipped (Sep-17 re-runs on same tip; Sep-16 full run: 978 pass, 15 fail, 9 skipped) · server: 27 pass, 0 fail · renderer: 1014 pass, 0 fail (118 files) · typecheck: pass (shared, core, server, client, renderer all exit 0; re-verified Sep-17)
## Acceptance
| # | item (verbatim from the prompt) | pass / fail / blocked | evidence (a test name, a file:line, a number) |
| 1 | spike/base on origin | pass | branch `spike/base` pushed to `origin` (fork `corneliu10/rowboat`); upstream push URL `DISABLED`; `git status -sb` → `## spike/base...origin/spike/base` |
| 2 | typecheck and test counts in the report | pass | typecheck 5/5 exit 0 (shared ~5 s, core ~15 s, server ~4 s, client ~2 s, renderer ~17 s); shared 321/321, server 27/27, renderer 1014/1014, core red-baseline recorded — full matrix in `docs/fork/00-baseline.md` §§Tests, Red tests |
| 3 | 00-boot.png exists | fail | `screencapture -x` → `could not create image from display`, exit 1 (2 attempts Sep-16, 1 attempt Sep-17); `docs/fork/img/` holds only `.gitkeep` |
| 4 | dev:sandbox ports recorded | pass | `[sandbox] ports server=54814 apps=54815 vite=54816`, instance `spike-base`, workdir `.sandbox/rowboat-dev-spike`; 200/401/421 probed |
| 5 | packaged .app path, bundle id and name recorded | pass | `apps/x/apps/main/out/Rowboat-darwin-arm64/Rowboat.app`, 423M (re-verified Sep-17), `CFBundleIdentifier com.rowboat.app` (`forge.config.cjs:226`), `CFBundleName Rowboat` |
| 6 | §Headless written (commands or the blocker) | pass | `docs/fork/00-baseline.md` §Headless: exact start/token/config commands + 6-row exchange matrix, re-probed Sep-17 (token 43 bytes, `{"sessions":[]}`, `{"showOnboarding":true}`, turn blocked at `No assistant model configured (connect a provider or sign in)`) |
| 7 | `git diff --stat upstream/main...spike/base` touches only docs/ and .gitignore | pass | 5 paths: `M .gitignore` + `docs/fork/` (`00-baseline.md`, `reports/README.md`, `reports/0-baseline.md`, `img/.gitkeep`); no source file touched; LICENSE intact |
## Decisions
- Green gate vs red baseline: typecheck is 5/5 green, but `test:core` is red on a clean checkout (persistent `chatgpt-auth.test.ts` ×3 via `chatgpt-selection.ts:57`, `catalog.test.ts` ×1, `status-tracker.test.ts` ×1; flaky across runs: `code-mode/git/service.test.ts`, deck/orgs/response-index/spreadsheet/skills-index). This lane forbids touching source files, so the failures cannot be fixed here; docs-only commits proceed with every red recorded and none omitted. Core "all green" is therefore a number (5–6 failed), not a claim.
- Toolchain: Node `24.19.0` (prompt-accepted) for everything although `x-tests.yml` uses Node 22 for vitest and `24.15.0` for packaging; pnpm `10.34.5` for `apps/x` (no pin) while corepack auto-switched to the pinned `10.20.0` (`apps/harbor/package.json:9`) inside `apps/harbor`.
- Runtime isolation: `COREPACK_HOME`/`XDG_*`/`npm_config_cache` redirected into `.local-home/` + `.cache/`, app workdirs into `.run/` + `.sandbox/`, `CI=true` (else `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`); `--seed-config` never used; root `.gitignore` extended with exactly those four dirs.
- Packaging set both `SKIP_CODE_SIGNING=1` (prompt) and `ROWBOAT_SKIP_CODE_SIGNING=1` (the variable `forge.config.cjs:13` actually reads); the prompt's variable alone does not skip signing.
- Steps 1–6 produce no repo file changes by design (toolchain/install/boot/sandbox/package/headless are verification only); commits exist for step 7 (two commits: `.gitignore`, then baseline docs) and step 8 (this report).
- Headless `sessions:sendMessage` shape resolved from code (`packages/shared/src/ipc.ts:713-727`, default agent `copilot` from `apps/renderer/src/App.tsx:2516-2517`); the no-provider error is the documented blocker, not a failure of the docs.
- First boot hung in a macOS reopen-after-crash `NSAlert runModal` (`NSPersistentUIRestorer`); worked around with local-only `defaults write com.github.Electron ApplePersistenceIgnoreState -bool YES` (OS pref, not repo). Parallel lanes on this machine need the same pref.
## Not verified
- `00-boot.png`: `screencapture` has no display access from this session (`could not create image from display`, exit 1; Sep-16 ×2, Sep-17 ×1); first-run screen content (expected `OnboardingModal`, `App.tsx:6397-6407`) not visually confirmed — corroborated only by headless `onboarding:getStatus` → `{"showOnboarding":true}`.
- Full chat-turn reply text: blocked at `No assistant model configured` — no `ANTHROPIC/OpenAI/OpenRouter` key, no `OLLAMA_HOST`, no `ROWBOAT_API_KEY` in env; nothing created or written to work around it.
- `test-agent.ts` (`apps/x/apps/main/src/test-agent.ts:1-19`) was documented, not executed — same provider blocker plus it needs `WorkDir/agents/test-agent.md`.
- Whether the persistent core failures also fail on upstream CI (Linux/Node 22) or are macOS/Node-24-specific — out of scope for this lane (no fixes allowed).
## Shared files
For each file another lane also edits, the hunk verbatim in a diff block.

```diff
diff --git a/.gitignore b/.gitignore
--- a/.gitignore
+++ b/.gitignore
@@ -11,3 +11,12 @@ data/
 .agents/
 .claude/skills/
 skills-lock.json
+
+# spike/base lane isolation: tool caches/homes and app runtime workdirs live
+# inside the checkout and must never be committed (see docs/fork/00-baseline.md).
+# out/ bundles and dist/ output are already ignored by the nested .gitignore
+# files in apps/x; ~/.rowboat data lives outside the repo by default.
+.local-home/
+.cache/
+.run/
+.sandbox/
```
