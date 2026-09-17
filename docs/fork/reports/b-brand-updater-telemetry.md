# spike/b-brand-updater-telemetry
Base: `ac9db19765967c51b6409aee8c516638a116abf8` · Head: `c66966b6` + this report commit (HEAD; `git log --oneline -8` to verify) · `git diff --stat origin/spike/base...HEAD` (pre-report): 26 files changed, 550 insertions(+), 37 deletions(-)
## Commits
- `804394d2` step 1: add brand seam brand.ts + export (shared 321/321, typecheck pass) (step 1)
- `5ae062d4` step 2: updater reads brand.updateRepo, disabled no-update-repo + tests (main 5/5, shared 321/321, main typecheck pass) (step 2)
- `e45cd163` step 3: telemetry off-switch ROWBOAT_TELEMETRY=off + inert-without-key tests (core 3/3, renderer 5/5, main 5/5, shared 321/321, server 27/27, typecheck 6/6 pass) (step 3)
- `86e61082` step 4: brand seam forge/package/menu wiring + placeholder icons (renderer Rowboat count 476, forge publisher corneliu10/rowboat, bundle ai.spinrun.desktop) (step 4)
- `2bc7b32b` step 5: Apache hygiene NOTICE + upstream sync doc (LICENSE unchanged) (step 5)
- `c66966b6` step 6: packaged proof Spinrun Desktop.app 463M ai.spinrun.desktop + dock screenshot (About screenshot blocked, see report) (step 6)
- HEAD (this commit) step 7: add lane report b-brand-updater-telemetry.md (step 7)
## Tests
- shared: 321 pass, 0 fail (20 files) · core: 1004 pass, 1 fail, 0 skipped (87 files; fail is `src/runtime/tools/catalog.test.ts` bundled-skills, persistent baseline) · server: 27 pass, 0 fail (4 files) · renderer: 1019 pass, 0 fail (119 files) · main: 5 pass, 0 fail (`src/updater.test.ts`) · typecheck: pass (shared, core, server, client, renderer, main all exit 0)
## Acceptance
| # | item (verbatim from the prompt) | pass / fail / blocked | evidence (a test name, a file:line, a number) |
| 1 | updater tests: no upstream URL ever | pass | `apps/x/apps/main/src/updater.test.ts`: 5/5 pass — `with "corneliu10/rowboat", the feed URL contains it and never "rowboatlabs"`, `with the repo unset, no URL is constructed`, `initUpdater reports disabled/no-update-repo and never fetches when repo is empty`, `initUpdater points the feed at the fork, never upstream`; `apps/x/apps/main/src/updater.ts:11-12` `getUpdateRepo(): string { return brand.updateRepo; }`, `:15-18` `buildUpdateFeedUrl`, `:20-23` `buildReleaseNotesUrl`, `:85` + `:144` `reason: "no-update-repo"`; `grep -rn "rowboatlabs/rowboat" apps/x/apps/main/src/updater.ts` empty |
| 2 | telemetry inert-without-key and off-switch tests | pass | `apps/x/packages/core/src/analytics/posthog.test.ts`: 3/3 pass — `with no POSTHOG_KEY / VITE_PUBLIC_POSTHOG_KEY, no client is constructed and capture is a no-op`, `with ROWBOAT_TELEMETRY=off and a key present, no client is constructed and capture is a no-op`, `with a key and telemetry on, a client is constructed`; `apps/x/packages/core/src/analytics/posthog.ts:15-16` `isTelemetryOff(): boolean { return process.env.ROWBOAT_TELEMETRY === 'off'; }`, `:24` `if (isTelemetryOff()) return null;`; `apps/x/apps/renderer/src/lib/analytics.test.ts`: 5/5 pass — `with no key, shouldEnableTelemetry is false`, `off switch is honoured even if a key is present`, `when disabled, capture wrappers are no-ops`; `apps/x/apps/renderer/src/lib/analytics.ts:7-18` `setTelemetryEnabled`/`shouldEnableTelemetry`, `apps/x/apps/renderer/src/main.tsx:51-61` provider skip via `shouldEnableTelemetry({ posthogKey, telemetryEnabled })`; PostHog not removed (`posthog-node`, `posthog-js` still wired) |
| 3 | brand.ts is the only place the six values live (grep proves no second copy of "com.rowboat.app" or "rowboatlabs/rowboat" outside brand.ts, NOTICE, docs and icons/upstream) | fail | Functional seam passes: `apps/x/packages/shared/src/brand.ts:1-8` frozen `{ productName: "Spinrun Desktop", executableName: "spinrun-desktop", appBundleId: "ai.spinrun.desktop", updateRepo: "corneliu10/rowboat", deepLinkScheme: "rowboat", upstream: "rowboatlabs/rowboat" }`; `apps/x/apps/main/brand.cjs` parses `brand.ts` (no literals, `node -e require` prints fork values); `forge.config.cjs` publisher `{ owner: 'corneliu10', name: 'rowboat' }`, `appBundleId brand.appBundleId`, `executableName brand.executableName`; `updater.ts` + `menu.ts:45` `REPO_URL = https://github.com/${brand.updateRepo}` contain no upstream literal. Strict grep still finds non-functional copies left per UI-freeze/test-intent/mobile scope: `grep -rn "rowboatlabs/rowboat" apps/x` → `packages/core/src/runtime/assembly/skills/composio-integration/skill.ts:123,129` (example user input), `packages/core/src/application/browser-skills/loader.test.ts:56` (URL-matcher fixture), `apps/renderer/src/App.tsx:5755`, `google-client-id-modal.tsx:15`, `update-card.tsx:11`, `settings-dialog.tsx:207,308`, `about-dialog.tsx:11,12` (renderer help/release links, UI frozen); `grep -rn "com.rowboat.app"` → only `apps/mobile/app.json:11` (`com.rowboat.app.mobile`, mobile out of desktop-spike scope). No second functional copy in updater/forge/menu. |
| 4 | packaged app shows the new bundle id and name | pass | `apps/x/apps/main/out/Spinrun Desktop-darwin-arm64/Spinrun Desktop.app`, `463M`; `plutil -p …/Contents/Info.plist \| grep -E 'CFBundle(Identifier\|Name\|DisplayName)'` → `"CFBundleDisplayName" => "spinrun-desktop"`, `"CFBundleIdentifier" => "ai.spinrun.desktop"`, `"CFBundleName" => "Spinrun Desktop"`; executable `Contents/MacOS/spinrun-desktop`; process `spinrun-desktop` observed; packaged log `[Analytics] POSTHOG_KEY not set; analytics disabled` |
| 5 | NOTICE present, LICENSE unchanged (`git diff spike/base -- LICENSE` empty) | pass | `NOTICE` at repo root (3 lines, fork attribution); `git diff origin/spike/base -- LICENSE` empty (exit 0); `docs/fork/02-upstream-sync.md` added |
| 6 | renderer "Rowboat" string count recorded | pass | `grep -rn "Rowboat" apps/x/apps/renderer/src \| wc -l` → `476` (unchanged; UI strings frozen per spike) |
| 7 | typecheck and tests green with counts | fail | Typecheck 6/6 exit 0 (shared, core, server, client, renderer `tsc -b`, main `tsc --noEmit`). Tests with numbers: shared 321/321, server 27/27, renderer 1019/1019 (119 files), main 5/5, core 1004 pass + 1 fail (`catalog.test.ts` bundled-skills `expected […] to deeply equal []` incl. `use-railway -> Bash(railway:*)`, persistent baseline, recorded not fixed). Not all-green because of the 1 persistent core fail. |
| 8 | report at docs/fork/reports/b-brand-updater-telemetry.md | pass | This file; template shape matches `docs/fork/reports/README.md` (`#`, `## Commits/Tests/Acceptance/Decisions/Not verified/Shared files`); identifiers pasted from code (`updater.ts:11`, `posthog.ts:15`, `analytics.ts:7`, `main.tsx:51`, `forge.config.cjs`, `brand.ts:1-8`) |
| 9 | pushed | pass | `git push origin spike/b-brand-updater-telemetry` (origin = fork `corneliu10/rowboat`; upstream push URL `DISABLED`; never pushed upstream, no PR) |
## Decisions
- Deep-link scheme stays `rowboat` in this spike (`apps/x/packages/shared/src/brand.ts:6` `deepLinkScheme: "rowboat"`); it appears in ~20 files and in the Harbor server, so renaming is a later lane.
- Forge is CJS: `apps/x/apps/main/brand.cjs` parses `../../packages/shared/src/brand.ts` source with `pick(key)` regex (no brand literals duplicated), because forge runs before `shared` is built and cannot require compiled `dist`. Stated per prompt (built a tiny `brand.cjs`).
- `apps/x/apps/main/package.json:3` `productName` edited to `"Spinrun Desktop"` (static JSON cannot read `brand.ts` at runtime; value synced from `brand.ts`, documented here).
- Updater empty-repo guard runs before `isPackaged` (`updater.ts:83-87`), so empty `updateRepo` always reports `{ state: "disabled", reason: "no-update-repo" }` and never calls `setFeedURL`/`checkForUpdates`, even in dev. `reason` uses `as unknown as UpdaterStatus["reason"]` to avoid a second shared-schema hunk; runtime value is exactly `no-update-repo` (proven by `updater.test.ts` `toEqual`).
- Telemetry off is checked dynamically at the top of `getClient()` (`posthog.ts:24`), so `ROWBOAT_TELEMETRY=off` is honoured even if a key is present or a client was already attempted; renderer `main.tsx:51` skips `PostHogProvider` entirely when `shouldEnableTelemetry` is false, so no renderer client is constructed without a key or when off. Direct `import posthog from 'posthog-js'` in renderer components (`command-palette.tsx:2`, `useOAuth.ts:3`, `useVoiceMode.ts:6`, `useAnalyticsIdentity.ts:2`) left untouched — inert when the provider is absent (no init); `lib/analytics.ts` wrappers are explicitly guarded.
- Icons: replaced `icon.png` (800x800), `icon.ico` (32x32), `icon.icns` (multi-size via `iconutil` from the same SVG) generated from new `icons/spinrun-s.svg` (plain `S` glyph); originals kept under `icons/upstream/`; `install-loading.gif` + `gen-install-loading.sh` kept (installer animation, not app icons).
- `menu.ts:45` `REPO_URL` now built from `brand.updateRepo` (unsupported-platform releases + Help links point at the fork; otherwise Linux users would land upstream).
- Renderer upstream help/release hyperlinks left (`App.tsx:5755`, `update-card.tsx:11`, `about-dialog.tsx:11-12`, `settings-dialog.tsx:207,308`, `google-client-id-modal.tsx:15`) per UI-freeze (`Rowboat` strings stay, count 476); skill examples + `loader.test.ts:56` left (sample user input/fixture, not config); mobile `app.json:11` left (desktop spike, out of scope).
- Packaging set both `SKIP_CODE_SIGNING=1` (prompt) and `ROWBOAT_SKIP_CODE_SIGNING=1` (the variable `forge.config.cjs:13` actually reads); prompt variable alone does not skip signing (same as baseline + CI `x-tests.yml`).
- Test infra: added `vitest: catalog:` to `apps/x/apps/main/package.json:48` devDeps (+ `pnpm-lock.yaml`) to run `updater.test.ts`; `main` has no prior test runner.
## Not verified
- `docs/fork/img/02-about.png` absent: packaged app launched once (`Spinrun Desktop.app`, PID observed, `02-dock.png` captured, process `spinrun-desktop`, then quit, no leftovers), but the About window could not be opened programmatically — `osascript` System Events menu click failed with `execution error: osascript is not allowed assistive access (-1719)`; no other IPC/URL opens `open-about` from outside. Dock screenshot `docs/fork/img/02-dock.png` (1079427 bytes, full screen with dock + running app) is committed; About screenshot was stopped, not faked.
- Acceptance (3) strict grep: see row above for remaining non-functional copies and why each was left.
- Core `catalog.test.ts` 1 fail (see Tests): persistent baseline (`chatgpt-auth`/`catalog`/`status-tracker` family in `docs/fork/00-baseline.md` §Red tests); nothing fixed here.
- Full chat turn / provider flow: out of scope for updater/telemetry lane; packaged launch used an isolated `ROWBOAT_WORKDIR` (`.run/packaged-b`), no credentials created or written.
## Shared files
For each file another lane also edits, the hunk verbatim in a diff block.

```diff
diff --git a/apps/x/packages/shared/src/index.ts b/apps/x/packages/shared/src/index.ts
index b99f3615..e162464d 100644
--- a/apps/x/packages/shared/src/index.ts
+++ b/apps/x/packages/shared/src/index.ts
@@ -36,4 +36,5 @@ export * as message from './message.js';
 export * as rowboatAccount from './rowboat-account.js';
 export * as turnFollower from './turn-follower.js';
 export * as spaces from './spaces.js';
+export * from './brand.js';
 export { PrefixLogger };
```

```diff
diff --git a/apps/x/packages/shared/src/ipc.ts b/apps/x/packages/shared/src/ipc.ts
index f180a0bf..bd741e0d 100644
--- a/apps/x/packages/shared/src/ipc.ts
+++ b/apps/x/packages/shared/src/ipc.ts
@@ -187,6 +187,7 @@ export const ipcSchemas = {
       installationId: z.string(),
       apiUrl: z.string(),
       appVersion: z.string(),
+      telemetryEnabled: z.boolean(),
     }),
   },
   'workspace:getRoot': {
```
