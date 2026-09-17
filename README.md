# Spinrun

Spinrun is a desktop agentic assistant for everyday work — emails, meetings, projects, and people — with memory that compounds from your mail, calendar, and notes. Everything runs locally on your machine.

The assistant is **Spinball**. In a Space, type `@spinball` and your Spinball picks it up on your machine and brings the result back. Deep links use `spinrun://`. Company: Spinrun. Site: https://spinrun.ai (docs: https://spinrun.ai/docs, support: https://spinrun.ai/support).

Spinrun is a fork of [Rowboat](https://github.com/rowboatlabs/rowboat) under the Apache License 2.0. See [NOTICE](NOTICE) for upstream attribution (required by Apache-2.0) and [LICENSE](LICENSE) for the license text. `LICENSE` and `NOTICE` stay byte-identical to the fork baseline.

## Run from source

Prerequisites: Node 24, pnpm 10 via corepack, `CI=true` so a store mismatch reinstalls instead of aborting.

```sh
# Harbor first (apps/x consumes it linked)
cd apps/harbor && CI=true pnpm install --frozen-lockfile && pnpm -r build

# Then the desktop
cd ../x && CI=true pnpm install --frozen-lockfile && npm run deps

# Dev (Vite + Electron + servers)
npm run dev

# Sandboxed dev (isolated workdir, no ~/.rowboat, no --seed-config)
npm run dev:sandbox -- --no-deps --workdir <checkout>/.sandbox/f --name spike-f
```

Typecheck: `npm run typecheck:shared`, `typecheck:core`, `typecheck:server`, `typecheck:client`, `typecheck:renderer` (all must exit 0).

Tests: `npm run test:shared`, `test:server`, `test:renderer` (green); `test:core` is red on clean upstream too — record the baseline failures, never fix or omit them (see `docs/fork/00-baseline.md` §Red tests).

Package (unsigned, skips signing like CI):

```sh
cd apps/x/apps/main && SKIP_CODE_SIGNING=1 ROWBOAT_SKIP_CODE_SIGNING=1 NODE_OPTIONS=--max-old-space-size=6144 npm run package
```

Bundle shows `CFBundleName "Spinrun"`, `CFBundleIdentifier ai.spinrun.desktop`, executable `spinrun`.

## The stub

`tools/control-plane-stub/server.mjs` is a dependency-free stand-in for Rowboat's control plane so the app boots signed-out with no phone-home.

```sh
STUB_PORT=4300 node tools/control-plane-stub/server.mjs &
API_URL=http://127.0.0.1:4300 ROWBOAT_TELEMETRY=off npm run dev:sandbox -- --no-deps --workdir <checkout>/.sandbox/f --name spike-f
```

The stub answers `GET /v1/config` (four fields plus a `billing.plans` catalog that `RowboatApiConfig.parse()` requires) and `GET /v1/me` (active `spike` plan, 1e12 credits); everything else is 404. Quit cleanly; no leftover processes.

## Switches

Env vars keep their `ROWBOAT_` prefix so the fork can still merge upstream. Never set a PostHog key in the build env.

- `ROWBOAT_TELEMETRY=off` — disables telemetry main-side and renderer-side even with a key present. Never set `POSTHOG_KEY` or `VITE_PUBLIC_POSTHOG_KEY`.
- `ROWBOAT_MANAGED_LLM` — managed-LLM switch (default off; the managed provider stays hidden and is never auto-selected when off).
- `API_URL` — control-plane base URL (point at the stub for local runs: `http://127.0.0.1:4300`). A signed-out app never asks for billing.

Rebrand check: `npm run rebrand:check` in `apps/x` (greps tracked files for whole-word `rowboat`, fails on any hit not in the script's allowlist; exits 0 when the rebrand is clean).
