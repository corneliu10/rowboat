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
