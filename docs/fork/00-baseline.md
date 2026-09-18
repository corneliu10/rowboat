# Baseline — `spike/base` @ `649a5f1bd12b53455e4f22a0221a4d51e12f8261`

Base = `origin/main` at clone time (`git rev-parse HEAD` → `649a5f1bd12b53455e4f22a0221a4d51e12f8261`).
Branch `spike/base` tracks `origin/main`. Upstream push URL is `DISABLED`; only `origin` (fork `corneliu10/rowboat`) is ever pushed.
All commands ran with cwd inside `~/Documents/rowboat`. Secrets were read from the environment only; nothing was written to a tracked file.
`VITE_PUBLIC_POSTHOG_KEY` and `POSTHOG_KEY` were never set (verified absent before dev/package runs) — builds send no telemetry
(`apps/x/ANALYTICS.md:296`: `[Analytics] POSTHOG_KEY not set; analytics disabled`).

> Re-verified 2026-09-17 on the same tip `649a5f1b` (no source changes): typecheck 5/5 exit 0
> (shared ~5 s, core ~15 s, server ~4 s, client ~2 s, renderer ~17 s); `test:shared` 321/321,
> `test:server` 27/27, `test:renderer` 118 files / 1014 tests pass; `test:core` still red on a clean
> checkout — run A: 3 files / 5 tests failed, 997 passed; run B: 4 files / 6 tests failed, 996 passed
> (persistent: `chatgpt-auth.test.ts` ×3, `catalog.test.ts` ×1, `status-tracker.test.ts` ×1; flaky across
> runs: `code-mode/git/service.test.ts`, deck/orgs/response-index/spreadsheet/skills-index).
> Headless matrix re-probed end-to-end (health, unauthorized, list, onboarding, create, sendMessage →
> `No assistant model configured`); `screencapture -x` still fails (`could not create image from display`,
> exit 1), so `docs/fork/img/00-boot.png` remains absent; `.app` still `423M`, `com.rowboat.app` / `Rowboat`.
> Full matrices below are the 2026-09-16 baseline runs; Sep-17 deltas are noted in §Tests/§Red tests.

Tool-cache / runtime isolation (all inside the checkout, all git-ignored, see root `.gitignore`):

- `COREPACK_HOME=$PWD/.local-home/corepack`
- `XDG_CACHE_HOME=$PWD/.cache`, `XDG_DATA_HOME=$PWD/.local-home/share`, `XDG_CONFIG_HOME=$PWD/.local-home/config`, `npm_config_cache=$PWD/.cache/npm`
- `CI=true` (required: without it pnpm aborts with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`)
- App runs used `ROWBOAT_WORKDIR` under `.run/` / `.sandbox/` (never `~/.rowboat`, never `--seed-config`)

## Toolchain

| Tool | Recorded | Upstream pin |
|---|---|---|
| `node -v` | `v24.19.0` | `24.15.0` (`.github/workflows/electron-build.yml:26`); `24.19.0` accepted per lane prompt |
| `pnpm -v` (apps/x) | `10.34.5` via corepack | no `packageManager` pin in `apps/x/package.json` |
| `pnpm -v` (apps/harbor) | `10.20.0` (corepack auto-switch via `packageManager` in `apps/harbor/package.json:9`) | `pnpm/action-setup@v4/v6` with `version: 10` |
| `corepack --version` | `0.35.0` | — |
| `xcode-select -p` | `/Library/Developer/CommandLineTools` | — |
| macOS | `ProductVersion: 26.5.2`, `BuildVersion: 25F84` (`sw_vers`) | CI runs `macos-latest` / `ubuntu-latest` |

Note: `.github/workflows/x-tests.yml` runs the vitest suites on Node 22 and the Electron package smoke test on `24.15.0`;
this baseline used Node `24.19.0` for everything.

## Install

CI prerequisite (`.github/workflows/x-tests.yml`): `apps/x` consumes linked `apps/harbor`, so harbor builds first.

1. `apps/harbor`: `pnpm install --frozen-lockfile && pnpm -r build` → exit 0, wall **21 s**.
   (`packages/protocol` + `packages/server` built; scope 2 of 3.)
2. `apps/x`: `pnpm install --frozen-lockfile` → exit 0, wall **201 s**. No fallback to bare `pnpm install` was needed.

## Build

`apps/x`: `npm run deps` → exit 0, wall **186 s**.
Chain (`apps/x/package.json:16`): `shared` (= `protocol` + `packages/shared` build) → `core` → `server` → `client` → `preload`.
Note: `npm run protocol` (`package.json:10`) re-runs `pnpm install --filter @rowboat/spaces-protocol` inside `apps/harbor`;
it inherits the isolated `COREPACK_HOME`/`CI=true` env or it aborts (see isolation note above).

## Tests

Typecheck — all pass (`tsc --noEmit` per package; `tsc -b` for renderer):

- `typecheck:shared` exit 0, **6 s** · `typecheck:core` exit 0, **18 s** · `typecheck:server` exit 0, **4 s** ·
  `typecheck:client` exit 0, **2 s** · `typecheck:renderer` exit 0, **31 s**

Vitest (`npm run test:*`, clean checkout, no fixes applied):

- `test:shared` exit 0, **9 s** — `Test Files 20 passed (20)`, `Tests 321 passed (321)`
- `test:server` exit 0, **4 s** — `Test Files 4 passed (4)`, `Tests 27 passed (27)`
- `test:renderer` exit 0, **98 s** — `Test Files 118 passed (118)`, `Tests 1014 passed (1014)`
- `test:core` **exit 1**, **99 s** — `Test Files 8 failed | 78 passed (86)`, `Tests 15 failed | 978 passed | 9 skipped (1002)`

The 15 core failures are RED ON A CLEAN CHECKOUT — recorded in §Red tests, fixed nothing. Targeted rerun of the
8 failed files (`npx vitest run <8 files>`, wall 61 s): `Test Files 6 failed | 2 passed (8)`,
`Tests 8 failed | 104 passed | 9 skipped (121)` — i.e. spreadsheet + skills-index failures were load timeouts,
**8 failures persist deterministically** (chatgpt-auth ×3, catalog ×1, orgs-session suite, response-index ×1,
status-tracker ×1, deck ×2 in the rerun set).

## Boot

`npm run dev` (with `ROWBOAT_WORKDIR=<checkout>/.run/rowboat`) booted the app:

- `http://localhost:5173` → `200` (vite `v7.3.0`, `ready in 710 ms`)
- `http://localhost:3220` → `401` (rowboat-server up, bearer guard replies `unauthorized`)
- `http://localhost:3210` → `421` (apps host listening)
- `<workdir>/server-key` minted (existence verified, value never printed); `config/`, `knowledge/` (fresh git repo), `agents/` created
- Renderer process observed with `--user-data-dir=<checkout>/.run/rowboat/.electron-data --app-path=<checkout>/apps/x/apps/main`
- Quit via SIGTERM to the `concurrently` wrapper: Electron exited, vite down (`000`). Log tail: `npm run renderer exited with code SIGTERM`.

First-run screen: **not visually verified** (see screenshot blocker). Code-derived expectation for a fresh workdir:
`OnboardingModal` gated by `onboarding:getStatus` (`apps/renderer/src/App.tsx:6397-6407`, `useState` at `:2951`),
steps `welcome → llm-setup → connect-accounts → code-mode → completion`
(`apps/renderer/src/components/onboarding/steps/`). Corroborated headlessly: fresh-workdir server answers
`{"showOnboarding":true}` (see §Headless).

Two environment findings, both local-only (no repo change):

1. First launch hung with Electron main at 0% CPU in `-[NSAlert runModal]` from
   `NSPersistentUIRestorer promptToIgnorePersistentStateWithCrashHistory:` (macOS reopen-after-crash prompt, unclickable
   from this session; see `/tmp/electron-sample.txt` call graph). Workaround, local OS pref only:
   `defaults write com.github.Electron ApplePersistenceIgnoreState -bool YES`. After that, boot proceeded.
   Parallel lanes launching dev Electron builds on this machine need the same pref.
2. `screencapture -x docs/fork/img/00-boot.png` failed twice with `could not create image from display`
   (shell session has no WindowServer/display access). **`00-boot.png` does not exist** — acceptance item (3) is not met;
   see `docs/fork/reports/0-baseline.md` §Not verified.

## Sandbox

`npm run dev:sandbox -- --no-deps --workdir <checkout>/.sandbox/rowboat-dev-spike --name spike-base`
(`--no-deps` per lane prompt; explicit `--workdir` keeps state in-checkout instead of `~/.rowboat-dev`;
`--seed-config` deliberately NOT used — it would copy real credentials):

- `[sandbox] instance  spike-base`
- `[sandbox] workdir   <checkout>/.sandbox/rowboat-dev-spike`
- `[sandbox] ports     server=54814 apps=54815 vite=54816` (auto-picked free trio)
- `http://localhost:54816` → `200` · `:54814` → `401` · `:54815` → `421`
- Workdir populated (`agents apps bases bg-tasks config events knowledge server-key server.lock skills todo …`),
  `server-key` minted, `.electron-data` profile present
- Quit: SIGTERM stopped children (`child rowboat-server exited (code 0)`, ports down); the `dev-sandbox.mjs`
  launcher wrapper lingered and needed SIGKILL. No `--seed-config`, no credentials copied.

This is the documented pattern every parallel lane uses (`apps/x/DEV_SANDBOX.md:7-18`).

## Package

`cd apps/x/apps/main && SKIP_CODE_SIGNING=1 ROWBOAT_SKIP_CODE_SIGNING=1 npm run package`
(`NODE_OPTIONS=--max-old-space-size=6144`, `VITE_PUBLIC_POSTHOG_KEY` absent), wall **249 s**, exit 0.

- Prompt says `SKIP_CODE_SIGNING=1`, but `apps/x/apps/main/forge.config.cjs:13` reads
  `ROWBOAT_SKIP_CODE_SIGNING` (`const SKIP_CODE_SIGNING = process.env.ROWBOAT_SKIP_CODE_SIGNING === '1'`);
  the prompt's variable alone does **not** skip signing — both were set (same as CI's `x-tests.yml` package job,
  which sets `ROWBOAT_SKIP_CODE_SIGNING: "1"`).
- Output: `apps/x/apps/main/out/Rowboat-darwin-arm64/Rowboat.app`, **`423M`** (`du -sh`)
- `plutil -p …/Contents/Info.plist | grep -E 'CFBundle(Identifier|Name)'`:
  `"CFBundleIdentifier" => "com.rowboat.app"` (matches `forge.config.cjs:226` `appBundleId`),
  `"CFBundleName" => "Rowboat"` (matches `productName` in `apps/x/apps/main/package.json:3`)
- `out/` is already ignored (`apps/x/apps/main/.gitignore:5`).

## Headless

Server: `apps/x/apps/server`, entry `node dist/standalone.js` (`package.json`: `"standalone"`), headless bundle
`npm run build:headless` (`scripts/build-headless.mjs`) → `dist-headless/` in **2 s**:
`rowboat-server.cjs` (51 MB), `README.md`, `package.json` (`node-pty` dep).
Per `apps/x/REMOTE_SERVER.md:37-44`, the bundle then needs `npm install --omit=dev` (provides `node-pty`;
here the `darwin-arm64` prebuild shipped, no compile). `dist-headless/` is ignored
(`apps/x/apps/server/.gitignore:3`).

Local run (isolated workdir, no credentials anywhere):

```sh
cd apps/x/apps/server && npm run build:headless
cd dist-headless && npm install --omit=dev   # node-pty for this host (REMOTE_SERVER.md:41)
export ROWBOAT_WORKDIR=<checkout>/.run/headless ROWBOAT_SERVER_PORT=54901
node rowboat-server.cjs
# → [server] rowboat-server listening on http://127.0.0.1:54901 (workdir: <checkout>/.run/headless)
# First boot mints the token at <workdir>/server-key; config at <workdir>/config/server.json
# ({lanEnabled, port}, default port 3220 — apps/server/src/config.ts: DEFAULT_PORT).
# Read the token into memory only: TOKEN="$(cat <workdir>/server-key)"
```

Verified exchange matrix (token passed as `Authorization: Bearer`, never printed; 43-byte token):

| # | Request | Result |
|---|---|---|
| 1 | `GET /health` (no auth; unauthenticated on purpose — `apps/server/src/server.ts:133-137`) | `{"ok":true,"name":"rowboat-server","apiVersion":0,"serverVersion":"0.0.0"}` |
| 2 | `POST /rpc/sessions:list` body `null`, no token | `{"error":{"code":"unauthorized","message":"missing or invalid bearer token"}}` (server.ts:140-145) |
| 3 | same + token, body `{}` | `{"sessions":[]}` |
| 4 | `POST /rpc/onboarding:getStatus` + token, body `null` | `{"showOnboarding":true}` |
| 5 | `POST /rpc/sessions:create` + token, body `{}` | `{"sessionId":"2026-09-16T18-13-39Z-0056774-000"}` |
| 6 | `POST /rpc/sessions:sendMessage` + token, correct shape (`sessionId`, `input:{role:"user",content}`, `config:{agent:{agentId:"copilot"}}` — default chat agent per `apps/renderer/src/App.tsx:2516-2517`; wire schema `packages/shared/src/ipc.ts:713-727`) | `{"error":{"code":"internal","message":"No assistant model configured (connect a provider or sign in)"}}` |

A full chat turn (reply text) was **not** completed: no provider credentials exist in this environment
(`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`OPENROUTER_API_KEY`/`OLLAMA_HOST`/`ROWBOAT_API_KEY` all absent) and none may be
created or written. A lane with a provider key in the environment plus `models.json` in the workdir can complete the
turn with the exact commands above. Malformed shapes return `invalid_request` with zod `issues` (probed, see report).

`apps/x/apps/main/src/test-agent.ts` is a legacy-runs driver, not a server client: it calls
`runsCore.createRun({ agentId: 'test-agent' })` + `bus.subscribe` + `createMessage(id, 'whats your name?')`
(`@x/core/dist/runtime/legacy/runs.js`), expecting an agent file at `WorkDir/agents/test-agent.md` (test-agent.ts:6).
It cannot drive a turn from a script in this environment either — same missing-provider blocker — so it was
documented, not executed.

### Addendum 2026-09-18 (lane C2): reading a turn headlessly

With a provider configured, the full turn works over plain RPC
(`apps/x/apps/server/src/core-deps.ts:165-179`): `POST /rpc/sessions:create`
`{}` → `{sessionId}`; `POST /rpc/sessions:sendMessage`
`{sessionId, input:{role:"user",content}, config:{agent:{agentId:"copilot"}}}`
→ `{turnId}`; then poll `POST /rpc/sessions:getTurn {turnId}` until the
events contain a terminal `turn_completed` (reply text in `output`),
`turn_failed` (`error`), or a pending `tool_permission_required` (answer with
`POST /rpc/sessions:respondToPermission {turnId, toolCallId,
decision:"allow"|"deny"}` and keep polling). The app-reported model id comes
from `sessions:list`/`sessions:get` (`lastModel`). The WS alternative is the
`sessions:events` broadcast (`server.ts:193`), but polling `getTurn` is
sufficient and is what lane C2 used (PONG + three agent turns, permission
ask→answer exchanges included).

## Red tests

Clean-checkout failures, `packages/core` (`npx vitest run`), **nothing fixed**. Full suite (2026-09-16):
15 failed / 978 passed / 9 skipped (86 files: 8 failed). Isolated rerun of the 8 files: 8 failed / 104 passed /
9 skipped. Re-runs 2026-09-17 (same tip, warm cache): run A — 5 failed / 997 passed (3 files);
run B — 6 failed / 996 passed (4 files), 0 skipped. The suite is load-flaky; the persistent core below
(`chatgpt-auth` ×3, `catalog` ×1, `status-tracker` ×1) failed in every run Sep-16 and Sep-17.

Persistent (fail in both runs):

- `src/auth/chatgpt-auth.test.ts` › `signOutChatGPT` › 3 tests
  (`best-effort revokes the refresh token (with client_id) then clears the store`,
  `still clears the store when revocation fails`, `is a no-op-safe local clear when nothing is stored`) —
  `ReferenceError: Cannot access '__vite_ssr_import_0__' before initialization` at
  `src/models/chatgpt-selection.ts:57` (`clearCodexSelections` → `container.resolve("modelConfigRepo")`).
- `src/runtime/tools/catalog.test.ts` › `bundled skills declare real builtin tools` ›
  `every tool name a bundled skill attaches exists in BuiltinTools` —
  `AssertionError: expected [ …(7) ] to deeply equal []`, received includes
  `"use-railway -> Bash(railway:*)"`, `"use-railway -> Bash(which:*)"`, `"use-railway -> Bash(command:*)"`,
  `"use-railway -> Bash(npm:*)"`, `"use-railway -> Bash(npx:*)"` (+2 more).
- `src/spaces/orgs-session.test.ts` (whole suite) — `beforeAll` hook timeout 10 s at `orgs-session.test.ts:74`
  (`await import('./orgs.js')`).
- `src/spaces/response-index.test.ts` › `SpaceResponseIndexer` › `caps the file at MAX_LINKS, dropping the oldest` —
  timeout 5 s at `response-index.test.ts:158`.
- `src/code-mode/sessions/status-tracker.test.ts` › `CodeSessionStatusTracker projection` ›
  `projects the shared machine: …` — ~5.3 s (timeout class).
- `src/runtime/tools/domains/deck.test.ts` — `deck-create › writes a parseable deck from an outline` (timeout 5 s
  at `deck.test.ts:106`) + 1 more in rerun (`deck-restyle › swaps the theme palette…`); 5 deck tests failed in the
  full run.

Load-flaky (failed in full run, passed in isolated rerun — still upstream, still recorded):

- `src/spreadsheet/spreadsheet.test.ts` › `createWorkbook` › `creates an xlsx and reads it back through loadSheetWindow`
- `src/runtime/assembly/skills/index.test.ts` › 3 disk-skill merge tests
- `src/runtime/tools/domains/deck.test.ts` › remaining 3–4 deck tests (full-run set of 5)
