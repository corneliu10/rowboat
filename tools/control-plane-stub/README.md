# Control-plane stub (lane A; defaults updated lane F2)

A dependency-free `node:http` stand-in for `https://api.spinrun.ai`
(`API_URL` default since lane F2). Answers `GET /v1/config` and `GET /v1/me` so the desktop app
boots signed-out and un-throttled; everything else is 404 JSON. See the
header comment in `server.mjs` for the shape rationale and
`docs/fork/01-control-plane.md` for the full endpoint inventory.

## Run the stub

```sh
# repo root
node tools/control-plane-stub/server.mjs            # port 4300
STUB_PORT=4310 node tools/control-plane-stub/server.mjs
```

## Run the app against the stub

```sh
cd apps/x
API_URL=http://127.0.0.1:4300 npm run dev:sandbox -- --no-deps
```

(`--no-deps` skips the workspace rebuild; add an explicit `--workdir`
under the checkout to keep runtime state out of `~/.rowboat-dev`, e.g.
`--workdir <checkout>/.sandbox/<name>`. Never `--seed-config` — it would
copy real credentials.)

## Run the contract test

```sh
# repo root (needs apps/x built: npm run deps in apps/x)
node --test tools/control-plane-stub/stub.test.mjs
```

The test starts the stub on a random port and parses `GET /v1/config` with
the client's own `RowboatApiConfig` zod schema (imported from the built
`packages/shared` dist). There is no client schema for the `GET /v1/me`
wire shape (`billing.ts` casts manually), so those assertions mirror the
`billing.ts:15-42` field reads instead — see the comment at the top of
`stub.test.mjs`.

## Deliberate deviation from the lane prompt

The prompt sketches `GET /v1/config` as four fields. The stub additionally
serves `billing: { plans: [spike] }` because `rowboat.ts:12` runs
`RowboatApiConfig.parse()`, which REQUIRES a billing catalog — without it
config parsing throws and billing/auth break. Optional catalog fields
(`creditActivations`, `modelRecommendations`) are omitted.
