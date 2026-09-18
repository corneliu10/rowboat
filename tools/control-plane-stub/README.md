# Control-plane stub (lane A; defaults updated lane F2; gateway added lane G)

A dependency-free `node:http` stand-in for `https://api.spinrun.ai`
(`API_URL` default since lane F2). Answers `GET /v1/config` and `GET /v1/me` so the desktop app
boots signed-out and un-throttled; lane G adds the managed-LLM gateway
(`POST /v1/llm/chat/completions`, `GET /v1/llm/models`,
`POST /v1/llm/images`); everything else is 404 JSON. See the
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

## Managed gateway (lane G)

`AI_GATEWAY_API_KEY` lives ONLY in the stub process environment — never in a
file, never in the app process. `STUB_LLM_UPSTREAM` (default
`https://ai-gateway.vercel.sh/v1`) is the real AI Gateway base the stub
forwards to. The desktop holds NO model key: it calls
`${API_URL}/v1/llm` with `Authorization: Bearer $SPINRUN_API_KEY` (`spr_…`);
the stub requires that prefix (else 401) and forwards with the platform key.

- `POST /v1/llm/chat/completions`: whitelist body (model, messages, tools,
  tool_choice, parallel_tool_calls, temperature, top_p, frequency_penalty,
  presence_penalty, stop, seed, response_format, stream, reasoning reduced to
  effort/enabled/exclude; `reasoning` is kept because lane C2 step 2b recorded
  the gateway ACCEPTS it — `thoughtsTokenCount:13`), `max_tokens` capped at
  8192, `stream_options.include_usage` forced when streaming, all
  `x-rowboat-*`/client-auth headers dropped, bytes piped verbatim, abort
  propagated. `STUB_LLM_FORCE=401|402|429` answers that status with an
  OpenAI-style error and no upstream call.
- `GET /v1/llm/models`: upstream `/models` mapped to `{data:[{id}]}`,
  language models only (entries whose `architecture.output_modalities`
  includes `text`, or have no such field); `?output_modalities=image` answers
  `{data:[]}` without upstream.
- `POST /v1/llm/images`: `501 {error:{code:"not_implemented",…}}`.
- One log line per request (`METHOD path -> status upstream=<ms>ms usage …`);
  never a body, never a key.

## Deliberate deviation from the lane prompt

The prompt sketches `GET /v1/config` as four fields. The stub additionally
serves `billing: { plans: [spike] }` because `rowboat.ts:12` runs
`RowboatApiConfig.parse()`, which REQUIRES a billing catalog — without it
config parsing throws and billing/auth break. Optional catalog fields
(`creditActivations`, `modelRecommendations`) are omitted.
