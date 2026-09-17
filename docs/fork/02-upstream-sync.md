# Upstream sync — lane b (brand / updater / telemetry)

Upstream remote (read-only, never push):

- `upstream  https://github.com/rowboatlabs/rowboat.git (fetch)`
- `upstream  DISABLED (push)`
- `origin    https://github.com/corneliu10/rowboat.git (fetch+push)` — fork, only remote ever pushed.

Verify with `git remote -v` before any sync. Never push to `upstream`, never open a PR upstream.

## Sync procedure

On a sync branch (not on a lane branch):

```sh
cd ~/Documents/rowboat
git fetch upstream
git checkout -b sync/upstream-YYYY-MM-DD spike/base
git rebase upstream/main
# resolve conflicts (see list below), then:
cd apps/x && pnpm install --frozen-lockfile && npm run deps
npm run typecheck:shared && npm run typecheck:core && npm run typecheck:server && npm run typecheck:client && npm run typecheck:renderer
npm run test:shared && npm run test:server && npm run test:renderer
# core is red on clean upstream — record counts, do not fix here
git diff spike/base -- LICENSE  # must be empty
```

Then fast-forward `spike/base` to the sync tip and rebase each lane (`spike/b-brand-updater-telemetry`, etc.) onto it, resolving lane conflicts the same way.

## Files this lane changed that will conflict on every sync

Functional (expect conflicts when upstream touches the same areas):

- `apps/x/apps/main/src/updater.ts` — brand import + `no-update-repo` guard + feed helpers
- `apps/x/apps/main/src/ipc.ts` — `analytics:bootstrap` returns `telemetryEnabled`
- `apps/x/apps/main/src/menu.ts` — `REPO_URL` built from `brand.updateRepo`
- `apps/x/apps/main/forge.config.cjs` — all names/ids/repos read from `brand.cjs`
- `apps/x/apps/main/package.json` — `productName` + `vitest` devDep
- `apps/x/pnpm-lock.yaml` — lockfile churn from the `vitest` addition
- `apps/x/packages/shared/src/ipc.ts` — `analytics:bootstrap` adds `telemetryEnabled`
- `apps/x/packages/shared/src/index.ts` — one line: `export * from './brand.js'`
- `apps/x/packages/core/src/analytics/posthog.ts` — `ROWBOAT_TELEMETRY=off` switch
- `apps/x/apps/renderer/src/lib/analytics.ts` — telemetry flag + guards
- `apps/x/apps/renderer/src/main.tsx` — bootstrap flag + provider skip

Additive (low conflict risk, upstream has no counterpart):

- `apps/x/packages/shared/src/brand.ts` (new, canonical six values)
- `apps/x/apps/main/brand.cjs` (new, parses `brand.ts`, no literals)
- `apps/x/apps/main/src/updater.test.ts`, `apps/x/packages/core/src/analytics/posthog.test.ts`, `apps/x/apps/renderer/src/lib/analytics.test.ts` (new)
- `apps/x/apps/main/icons/spinrun-s.svg`, `apps/x/apps/main/icons/upstream/` (new)
- `NOTICE` (new, fork attribution)
- `docs/fork/02-upstream-sync.md`, `docs/fork/reports/b-brand-updater-telemetry.md` (fork-only docs)

Binary (will conflict if upstream redesigns icons — keep `icons/upstream/` originals to rebase):

- `apps/x/apps/main/icons/icon.png`, `icon.ico`, `icon.icns` (placeholder set)

## Checklist to re-verify updater and telemetry after each sync

- [ ] `git diff spike/base -- LICENSE` empty (LICENSE byte-identical)
- [ ] `NOTICE` present at repo root with fork attribution
- [ ] `apps/x/packages/shared/src/brand.ts` still exports the six frozen values; `brand.updateRepo` is the fork
- [ ] `grep -rn "rowboatlabs/rowboat" apps/x/apps/main/src/updater.ts` empty; feed URL built from `brand.updateRepo`
- [ ] `apps/x/apps/main/src/updater.test.ts`: 5/5 pass, feed contains fork, never upstream, empty repo → disabled `no-update-repo`, no fetch
- [ ] `apps/x/packages/core/src/analytics/posthog.test.ts`: 3/3 pass (inert without key, off-switch with key, on-switch builds client)
- [ ] `apps/x/apps/renderer/src/lib/analytics.test.ts`: 5/5 pass (no-key false, off honoured with key, disabled no-ops)
- [ ] `ROWBOAT_TELEMETRY=off` honoured main-side even with key; bootstrap payload carries `telemetryEnabled` to renderer
- [ ] `VITE_PUBLIC_POSTHOG_KEY` and `POSTHOG_KEY` absent in build env (`env | grep -i posthog` shows no `POSTHOG_KEY=`)
- [ ] `node -e "require('./apps/x/apps/main/brand.cjs')"` prints fork values; `forge.config.cjs` publisher is fork, `appBundleId` is new id
- [ ] Typechecks green with counts: shared, core, server, client, renderer, main
- [ ] Tests green with counts: shared, server, renderer; core red baseline recorded, not fixed here
- [ ] Packaged `.app` `Info.plist` shows new `CFBundleIdentifier` and name (see lane report Goal 5)
