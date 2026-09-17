# spike/a-control-plane
Base: `ac9db197` (`origin/spike/base`) · Head: `72e2a7f7` + this report commit (HEAD; `git log --oneline -3` to verify) · `git diff --stat ac9db197...HEAD`: 5 files changed, 372 insertions(+)
## Commits
- `72e2a7f7` lane A part 1+2: control-plane inventory and stub (server, README, contract test) (parts 1+2)
- HEAD (this commit) lane A part 3 + report: proof runs and lane report (part 3 + report)
## Tests
- shared: 321 pass, 0 fail · core: red on clean checkout — run B: 10 failed / 956 passed / 13 skipped (979), files 10 failed / 76 passed; runs A+C: persistent `chatgpt-auth.test.ts` ×3 + `catalog.test.ts` ×1 + `status-tracker.test.ts` ×1, remainder load-flaky and varying (spaces whole-file timeouts, `git/service`, `deck`, `loopback-server`, `slack`, `outlook`, `structured`, `registry`, `google-client-factory`, `response-index`) · server: 27 pass, 0 fail · renderer: 1013 pass, 1 fail (`pptx-editor.test.tsx > dirty editor`, 6708ms timing flake; file untouched) · stub contract (`node --test tools/control-plane-stub/stub.test.mjs`): 3 pass, 0 fail · typecheck: pass (shared, core, server, client, renderer all exit 0)
## Acceptance
| # | item (verbatim from the prompt) | pass / fail / blocked | evidence (a test name, a file:line, a number) |
| 1 | 01-control-plane.md has a row for every API_URL importer named above plus any grep found | pass | 29 rows in `docs/fork/01-control-plane.md`; the 4 named files with no direct `API_URL` use have rows anyway (`account.ts` local-only gate, `oauth-flows.ts` via `getBillingInfo`, renderer files posthog-props-only); extras: `analytics/posthog.ts`, static `rowboatlabs.com` links, mobile apex, test fixture |
| 2 | the stub's test passes and the two shapes are the client's | pass | 3/3 pass; `/v1/config` parsed with the client's own `RowboatApiConfig` (imported from built `packages/shared` dist); `/v1/me` assertions mirror `billing.ts:15-42` (no client schema exists — said so in `stub.test.mjs` header) |
| 3 | the dead-backend run and the stub run are each documented with the error list | pass | `docs/fork/01-control-plane.md` §Proof: dead (`OAuth connection failed: TypeError: fetch failed` via `rowboat.js:8` ← `providers.js:135` ← `oauth-flows.js:308`) vs stub (4× `GET /v1/config -> 200`, zero error lines in 239-line log) |
| 4 | typecheck and tests green with counts | fail | typecheck 5/5 exit 0; shared 321/321, server 27/27, stub 3/3 green; renderer 1013/1014 (timing flake, untouched file); core red on clean checkout (persistent set + load flakes, untouched files) — counts above, reds never omitted |
| 5 | report at docs/fork/reports/a-control-plane.md | pass | this file, in the `reports/README.md` template shape |
| 6 | pushed | pass | branch `spike/a-control-plane` pushed to `origin` (fork); upstream push URL `DISABLED`; no PR opened anywhere |
## Decisions
- `GET /v1/config` serves `billing: { plans: [spike] }` beyond the prompt's four fields: `rowboat.ts:12` runs `RowboatApiConfig.parse()`, which REQUIRES a billing catalog — without it config parsing throws. Optional `creditActivations`/`modelRecommendations` omitted. Deviation documented in `tools/control-plane-stub/README.md`.
- `GET /v1/me` ignores auth (real backend wants Bearer): the signed-out app never calls it (`getAccessToken()` throws first), so leniency only helps scripts. Plan `spike` buckets hold 1e12 / use 0 — never runs out.
- `appUrl` is built from the actual listen port per request, so fixed-port runs and random-port tests both see a correct URL (asserted in the test).
- NO `remote-config.ts` fallback hunk: no crash found. Config failures are caught per caller (`rowboat-selection.ts:47` `.catch(() => null)`; `apexUrl` throws a friendly Spaces error; oauth logs `[OAuth] Failed to initialize user via /v1/me` and returns undefined). The one-hunk allowance is unused — no source file touched.
- Sandbox workdirs landed under `apps/x/.sandbox/` (cwd was `apps/x` at invocation) instead of the repo-root `.sandbox/`; both are git-ignored. Explicit `--workdir` used in both runs; `--seed-config` never used.
- `pnpm` ran via the system binary with the default HOME cache: redirecting `XDG_CACHE_HOME` into the checkout made corepack try to fetch a phantom `pnpm-12.4.2` (`MODULE_NOT_FOUND`). Caches live outside the repo; the tree is unaffected.
- Screenshots intentionally NOT committed: `screencapture` works here, but the frame showed the operator's private desktop (Synara window) — the dev Electron window never presented itself — so publishing it to the fork was refused; file deleted after inspection.
- Soak was ~3.5 min per run, not 5: with no controllable window there was no UI to drive; server pollers (15s LiveNote/BgTask, 30s credential watchers) were covered several times over.
## Not verified
- Interactive five-minute use across chat, notes, email, meetings, browser, code, settings; per-surface error toasts — the dev Electron window never presented on screen from this session, so no surface could be opened.
- `docs/fork/img/01-*.png` — see Screenshots decision above; `img/` holds only `.gitkeep`.
- Full chat-turn reply text (no provider keys in env), Spaces flows (`spacesApexUrl: null` by design), gateway / voice / Composio / Google-OAuth against a real backend (stub 404s them by design).
- Whether the core/renderer flakes reproduce on upstream CI or are this-machine load artifacts (import phase hit 369 s with sandboxes + Electron + suites sharing the box); lane files are docs + dependency-free `.mjs`, so no regression vector exists.
## Shared files
None — no source file touched and no other lane's file edited. (Had a `remote-config.ts` fallback been needed it would have been listed here verbatim; it was not.)
