# Harbor (lane e)

Two modes, the exact commands, what worked, and the OIDC requirement with an
assessment of running Harbor behind spinrun's Supabase Auth. All identifiers
are pasted from the code; line citations point at this checkout.

## 1. Dev mode (single org, in memory)

The dev entry is `apps/harbor/packages/server/src/main.ts` (`startDevHarbor`).
In-memory by default — restart is a clean slate; `DATABASE_URL` flips it to
durable Postgres with idempotent seeding (main.ts:13-19,129-135). Without
`AUTH_ISSUER` it uses dev tokens: `Authorization: Bearer dev-<memberId>`
(main.ts:191-192, auth.ts:46-55). First sight of a dev token creates the
member (auth.ts:57-64) — the stand-in for the invite ceremony.

Exact commands (cwd = worktree root; pnpm 10.20.0 via
`apps/harbor/package.json:9`):

```sh
cd apps/harbor && pnpm install --frozen-lockfile && pnpm build
cd packages/server && pnpm dev   # PORT defaults to 4272 (main.ts:52)
```

What worked (2026-09-17, this lane):

- Server booted in-memory, seeded team
  `ramnique, harsh, gagan, prakhar` (main.ts:21-27) and the `Roadboard`
  space (`01M2R6NG49TT1JF7Q3QEYT4NFN`).
- From a `dev:sandbox` desktop instance
  (`cd apps/x && npm run dev:sandbox -- --no-deps --workdir
  <checkout>/.sandbox/rowboat-e-harbor --name e-harbor` → `server=50218
  apps=50219 vite=50220`; `:50218` → 401, `:50219` → 421, `:50220` → 200,
  `server-key` minted), the dev server was added through the desktop's own
  code path — the exact functions the `spaces:addOrg` / `spaces:createSpace`
  / `spaces:postMessage` IPC handlers call
  (apps/x/apps/main/src/spaces/ipc.ts:170-173,216-219):
  `addDevOrg({ baseUrl: 'http://localhost:4272', memberId: 'ramnique' })`
  (apps/x/packages/core/src/spaces/orgs.ts:323-346) wrote
  `<workdir>/config/spaces_orgs.json`; `createSpace('e-harbor lane')` →
  `01M2R78RGRW9HJEAFEZ72TMAYH`; two `postMessage` calls with
  `actingMode: 'direct'` (offsets 2 and 3).
- The second message carries the mention token
  `[@rowboat](#rowboat)` and the org stamps it: `mentionsRowboat: true`
  (protocol `mentions.ts`; verified on `GET
  /v1/spaces/01M2R78RGRW9HJEAFEZ72TMAYH/stream`).
- Agent reply: **not tested — no model key.** No `ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `OLLAMA_HOST` / `ROWBOAT_API_KEY`
  exists in this environment and none may be created; the sandbox
  `config/models.json` is 31 bytes with no `apiKey`. The stream still holds
  exactly the 2 posted messages (no reply, no reaction).
- Screenshot `docs/fork/img/05-spaces.png`: the sandbox desktop on first run
  shows the `OnboardingModal` (`Welcome → Providers → Connect → Code →
  Done`), matching the fresh-workdir expectation
  (`apps/renderer/src/App.tsx:6397-6407`, `onboarding:getStatus` →
  `{"showOnboarding":true}`). A Space screenshot from inside the app was not
  possible: onboarding gates the UI and there is no provider to complete it
  with. An earlier `05-desktop.png` captured the host screen instead of the
  app and was deleted, not committed.

## 2. Deployment mode (multi-org, Postgres)

`HARBOR_MODE=deployment` serves 1..N orgs from one process over one Postgres,
routing Host (X-Forwarded-Host wins) → org → cached per-org runtime
(deployment.ts:20-26,146-149). `HarborService` stays single-org by design;
orgs are created self-serve on the apex face (apex.ts:49-124).

Compose file: `deploy/harbor/docker-compose.yml` + `deploy/harbor/.env.example`
(new in this lane):

```sh
docker compose -f deploy/harbor/docker-compose.yml up --build -d
docker compose -f deploy/harbor/docker-compose.yml ps -a
docker compose -f deploy/harbor/docker-compose.yml logs harbor
```

- `postgres:16`, volume `harbor-e-pgdata`, trust auth (local spike only, so
  no password lives in a tracked file), health-gated.
- `harbor` built from `apps/harbor/Dockerfile` (build context = apps/harbor,
  Dockerfile:2; image 351 MB), env from `.env.example`
  (`HARBOR_MODE=deployment`, `DATABASE_URL=postgres://harbor@postgres:5432/harbor`,
  `APEX_DOMAIN=harbor.localtest.me`, `PORT=4272`, `BLOBS_DIR=/blobs` on a
  named volume, every `AUTH_*` / `BLOBS_S3_*` var named in main.ts present
  with an empty value and a comment). Host port is 4273 so the dev stub on
  4272 is untouched.

What worked / observed (verbatim):

- Without `AUTH_ISSUER` the server **does not start**. `logs harbor` is one
  line, exit code 1 (main.ts:99-103):

  ```text
  HARBOR_MODE=deployment requires AUTH_ISSUER
  ```

  `ps -a` at that point:

  ```text
  harbor-e-harbor-harbor-1     harbor-e-harbor-harbor   "docker-entrypoint.s…"   harbor     2 minutes ago   Exited (1) About a minute ago
  harbor-e-harbor-postgres-1   postgres:16              "docker-entrypoint.s…"   postgres   2 minutes ago   Up 2 minutes (healthy)          5432/tcp
  ```

  Port 4273 refused (`curl` exit 7). There is no org-creation or
  client-connect error in this state — the process exits before listening.
- With an (uncommitted, `-e`) dummy issuer
  `AUTH_ISSUER=https://dummy.invalid/auth/v1` the deployment boots
  (`apex https://harbor.localtest.me`, `listening :4272`, blobs `disk
  /blobs`) and the OIDC-less behaviour is observable per call:
  - `GET /healthz` → `{"ok":true}` (host-independent, deployment.ts:154-158).
  - Unknown org domain → `404 {"code":"not_found","message":"no org on this
    domain","retryable":false}` (deployment.ts:165-169).
  - `POST /v1/orgs` (apex, `Host: harbor.localtest.me`) with no token →
    `401 {"code":"unauthorized","message":"missing bearer
    token","retryable":false}` plus `WWW-Authenticate: Bearer
    resource_metadata="http://harbor.localtest.me/.well-known/oauth-protected-resource"`
    (apex.ts:52-60; driver auth.ts:27-31).
  - Same with `Bearer dummy` → `{"code":"internal","message":"authorization
    server discovery failed for
    https://dummy.invalid/auth/v1","retryable":true}` — discovery runs
    before any member lookup (auth-oidc.ts:92-132).
- No external OIDC app or account was created (paper assessment below).

## 3. The OIDC requirement

- Deployment refuses to boot without all three of `DATABASE_URL`,
  `APEX_DOMAIN`, `AUTH_ISSUER` (main.ts:98-104). Orgs without an issuer are
  refused at runtime unless the deployment opts into dev orgs
  (deployment.ts:103-104, `allowDevOrgs` default false) — and the main.ts
  deployment path never opts in, so **every org needs an issuer**.
- Members arrive only via OAuth + invite binds; the apex caller becomes the
  provisioned first admin (main.ts:92-95, apex.ts:92-104, CONTRACT.md:37-49).
- The consent page (`GET /oauth/consent`) mounts only with oidc +
  `AUTH_PUBLISHABLE_KEY` (deployment.ts:122-124, server.ts:56-60).

Which issuer shapes are accepted (auth-oidc.ts):

- One pinned issuer per org (`OidcOptions.issuer`, auth-oidc.ts:15-26).
- Discovery tries, in order: `{issuer}/.well-known/oauth-authorization-server`,
  `{issuer}/.well-known/openid-configuration`, then the strict RFC 8414
  path-inserted form (auth-oidc.ts:110-114). The metadata's `issuer` MUST
  match and `jwks_uri` must be present (auth-oidc.ts:125-129).
- Bearers are JWKS-verified with `jose` (default `['ES256', 'RS256']`,
  auth-oidc.ts:52-56); `sub` is required; profile comes from `email` /
  `name` / `user_metadata.full_name|name` (auth-oidc.ts:61-75).
- `(iss, sub)` → member lookup NEVER auto-creates; unknown = `not_a_member`
  (auth-oidc.ts:78-84). Audience check is deliberately off by default
  (auth-oidc.ts:18-22).

What `AUTH_PUBLISHABLE_KEY` is for, and which provider it implies:

- It is the AS's publishable/anon key — public by design; the browser sends
  it as `apikey` for the consent state machine (claim GET is mandatory
  before approve/deny POST) and for reading the AS `/settings`
  (consent.ts:20-27,103-133).
- It implies **Supabase Auth (GoTrue)**: "This is Supabase-flagship glue,
  not protocol: an org whose AS hosts its own login+consent (Keycloak,
  corporate IdP) never mounts this route" (consent.ts:9-11). Sign-in buttons
  are derived from that project's `/settings` `external.{google,azure,…}`
  flags; the fleet enables Google + Microsoft, social only — Harbor never
  sees a credential (consent.ts:13-18, CONTRACT.md:68-77).

Could a Supabase Auth project serve as `AUTH_ISSUER`? **Yes — it is the
flagship.** The driver documents the pinned issuer as
`https://<project>.supabase.co/auth/v1` (auth-oidc.ts:16, consent.ts:21) and
the stack is "live-verified against a real Supabase Auth stack (ES256 access
tokens, all three faces)" (CONTRACT.md:30-37,302). What such a project must
provide: the issuer URL, its anon key as `AUTH_PUBLISHABLE_KEY`, at least one
social provider enabled, and `site_url` pointing at the org address (consent
redirect target = site_url + authorization_url_path, CONTRACT.md:73-77).

Assessment for spinrun's Supabase Auth: same GoTrue shape, so the same wiring
applies — pin the project's `https://<ref>.supabase.co/auth/v1` URL as
`AUTH_ISSUER`, put its anon key in `AUTH_PUBLISHABLE_KEY`, enable
Google/Microsoft on the project. Three caveats, all from the code: (1) the
deployment pins **one** issuer for the apex and every apex-created org
(deployment.ts:88-101, apex.ts:38-39) — per-org issuers exist in the data
model (`OrgConfig.issuer`) but apex self-serve always pins the deployment's;
(2) leave `AUTH_AUDIENCE` unset — Supabase mints the realm-generic audience
`authenticated`, so membership is the boundary (auth-oidc.ts:18-22); (3) the
one unautomatable step is a real Google/Microsoft click-through, pending
provider creds on that Supabase project (CONTRACT.md:301). No live check
against spinrun's project was run — no credentials exist in this environment
and none were created.

## 4. Harbor's own tests

`cd apps/harbor && pnpm test` (`pnpm -r test`; protocol has no test script,
server runs `vitest run`):

- Full suite at default parallelism: red on PGlite `beforeAll` hook timeouts
  (e.g. `test/pg-store.test.ts:24` `Hook timed out in 10000ms` at
  `pgliteDb()`; `test/migrations.test.ts` test timeouts) — every failure is a
  `(postgres store)` / PGlite-backed suite; all memory-store suites pass.
  Zero `apps/harbor` files were changed in this lane (`git status` shows only
  `deploy/` + `docs/`), so this is environmental, not a regression.
- Isolated file: `test/members.test.ts` 8/8 pass in 12 s (postgres variant
  included) — PGlite works unloaded.
- Bounded rerun `vitest run --maxWorkers=2`: **25 files passed (25), 381
  passed + 1 skipped (382), exit 0, 45 s.** The 1 skip is the S3 blob
  conformance suite (`HARBOR_TEST_S3_BUCKET` unset, blobs.test.ts:36,129).
- Typecheck `pnpm typecheck` (protocol + server `tsc --noEmit`): exit 0.
