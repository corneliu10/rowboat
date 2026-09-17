# Control-plane inventory — `spike/a-control-plane`

Base: `ac9db197` (`origin/spike/base`). Method: every importer of `API_URL` on
`origin/spike/base` plus `grep API_URL` / `grep rowboatlabs.com` across `apps/x`
(no `node_modules`, no `dist`). Default backend is `https://api.x.rowboatlabs.com`
(`apps/x/packages/core/src/config/env.ts:1-2`), overridden per-process by `API_URL`.

Signed-out rule (verified in code): the Exa, voice-TTS, Composio and gateway
paths all gate on `isSignedIn()` (`account.ts`) and fall back to third-party
BYOK endpoints when signed out — so the stub only has to satisfy the
always-on reads (`GET /v1/config`, and `GET /v1/me` once a token exists).

| # | call site (file:line) | endpoint or host | what it is for | what the user sees if it fails | class | est |
|---|---|---|---|---|---|
| 1 | `config/env.ts:1-2` | default `https://api.x.rowboatlabs.com`, override `process.env.API_URL` | base URL of the whole control plane | app talks to prod backend unless overridden | STUB | S |
| 2 | `config/remote-config.ts:25` | `GET /v1/config` → `{appUrl, supabaseUrl, websocketApiUrl, spacesApexUrl}` | discovers webapp host (rowboat-mode OAuth), voice relay socket, spaces fleet | `/v1/config returned N` / fetch `TypeError`; per-surface errors below | STUB | S |
| 3 | `config/rowboat.ts:11` | `GET /v1/config` parsed as `RowboatApiConfig` (`shared/rowboat-account.ts:22-57`: + required `billing` catalog, optional `creditActivations`, `modelRecommendations`) | billing catalog, rewards catalog, model recommendations | `ZodError` / fetch throw; billing, auth-init, spaces, model-recs all break | STUB | S |
| 4 | `billing/billing.ts:9` | `GET /v1/me` (Bearer) → `{user:{id,email}, billing:{planId,status,trialExpiresAt,usage:{monthly,daily,store?}}}` | identity + plan + credit buckets | `Billing API failed: N`; sign-in init logs `[OAuth] Failed to initialize user via /v1/me` (`auth/oauth-flows.ts:283`); settings/billing shows error | STUB | S |
| 5 | `billing/credits.ts:189` | `POST /v1/billing/credit-activations` | first-time-action credit grants | grant fails, rewards UI error | DELETE | S |
| 6 | `billing/credits.ts:251` | `POST /v1/referral` | referral code creation | referral UI error | DELETE | S |
| 7 | `billing/credits.ts:300` | `POST /v1/referral/claims` | referral claim | claim error | DELETE | S |
| 8 | `models/gateway.ts:23` | `{API_URL}/v1/llm` (OpenAI-compatible baseURL, Rowboat provider; `authedFetch` adds Bearer + `x-rowboat-*` headers) | every Rowboat-cloud chat turn | chat turn fails with provider error in the thread | REPLACE-WITH-SPINRUN | L |
| 9 | `models/gateway.ts:42` | `GET /v1/llm/models` | Rowboat provider model catalog | catalog falls back / Rowboat provider hidden | REPLACE-WITH-SPINRUN | M |
| 10 | `models/gateway.ts:70` | `GET /v1/llm/models?output_modalities=image` | image-model allowlist | defensive: odd body → `[]`; failed request throws → image tools unavailable | REPLACE-WITH-SPINRUN | S |
| 11 | `auth/google-backend-oauth.ts:101` | `POST /v1/google-oauth/claim` | retrieve Google tokens parked by the web OAuth dance | Google connect fails after the browser dance | REPLACE-WITH-SPINRUN | M |
| 12 | `auth/google-backend-oauth.ts:120` | `POST /v1/google-oauth/claim-picked` | picker `fileIds` + fresh `drive.file` token | picker finishes but files/tokens missing | REPLACE-WITH-SPINRUN | M |
| 13 | `auth/google-backend-oauth.ts:141` | `POST /v1/google-oauth/refresh` | refresh Google tokens | background sync stalls, re-connect prompt | REPLACE-WITH-SPINRUN | M |
| 14 | `knowledge/google-picker-managed.ts:30,78` | webapp picker URLs (`getWebappUrl()` from #2) + #12 | Drive picker round-trip via deep link | picker window / deep link fails | REPLACE-WITH-SPINRUN | M |
| 15 | `voice/voice.ts:49` | `/v1/voice/text-to-speech/{voiceId}` — signed-in only; signed-out goes direct to `https://api.elevenlabs.io` via `elevenlabs.json` BYOK | spoken replies / live voice | TTS error, text-only fallback | REPLACE-WITH-SPINRUN (BYOK path KEEP) | M |
| 16 | `voice/voice.ts:203` | `websocketApiUrl` from #2 | live-voice relay socket | live voice won't connect | REPLACE-WITH-SPINRUN | M |
| 17 | `runtime/tools/domains/web.ts:57` | `POST /v1/search/exa` — signed-in only; signed-out reads `exa-search.json` BYOK and calls Exa direct | agent web-search tool | tool returns proxy error when signed in | KEEP (BYOK direct) | S |
| 18 | `composio/client.ts:30` | `{API_URL}/v1/composio` — signed-in only (`COMPOSIO_BASE_URL=https://backend.composio.dev/api/v3` otherwise) | managed connectors | connector calls 404 / auth errors | REPLACE-WITH-SPINRUN (direct BYOK KEEP) | M |
| 19 | `spaces/oauth.ts:247-260` | managed fleet apex (`ROWBOAT_SPACES_APEX` override → `spacesApexUrl` from #2 → else throw) | Spaces org create/list | `Spaces is not available for this environment yet (no fleet configured)` | DELETE | M |
| 20 | `apps/host-api.ts:45` | `API_URL` inside an error string only (backend-mismatch diagnostic) | tells the user which backend this instance talks to | message names the backend URL | KEEP | S |
| 21 | `core/src/analytics/posthog.ts:33,80` | `api_url` event property (lane B owns `analytics/*` — listed, not touched) | telemetry context | nothing visible (keys unset, builds send no telemetry) | DELETE | S |
| 22 | `apps/main/src/ipc.ts:1154` | `analytics:bootstrap` returns `apiUrl` to the renderer (lane B adjacent — listed, not touched) | analytics context prop | nothing visible | KEEP | S |
| 23 | `apps/renderer/src/main.tsx:34-45`, `apps/renderer/src/lib/analytics.ts:10-20` | `apiUrl` → `posthog.register({api_url})` props only (lane B adjacent) | telemetry props | nothing visible | DELETE | S |
| 24 | `shared/src/rowboat-account.ts:27` | comment only (`spacesApexUrl` semantics) | documents #19 | n/a | KEEP | S |
| 25 | `account/account.ts:5-9` | no backend call — local `oauthRepo.read('rowboat')` sign-in gate | gates every signed-in proxy branch (#15, #17, #18, #8) | signed-out → BYOK branches, no backend touched | REPLACE-WITH-SPINRUN | M |
| 26 | `auth/oauth-flows.ts:269` | `/v1/me` via `getBillingInfo()` at sign-in init | completes app sign-in identity | sign-in finishes without identity; `[OAuth] Failed to initialize user via /v1/me` | REPLACE-WITH-SPINRUN | L |
| 27 | `auth/oauth-flows.ts:697,787` | `https://oauth2.googleapis.com/revoke` (third-party, not Rowboat) | provider token revoke on disconnect | disconnect warns; local clear still happens | KEEP | S |
| 28 | `about-dialog.tsx:10-13`, `settings-dialog.tsx:330-349` | `https://www.rowboatlabs.com/*`, `mailto:contact@rowboatlabs.com` | website / support / terms / privacy links | dead links only | KEEP | S |
| 29 | `apps/mobile/.../account.tsx:13` | default `https://spaces.x.rowboatlabs.com` | mobile Spaces apex (mobile is parked per `SEPARATION_PLAN.md`) | out of scope | KEEP | — |

Not backend calls (checked while grepping, recorded so the next lane doesn't re-hunt):
`auth/oauth-flows.ts` revoke fetches (#27) hit Google, not Rowboat.
`todo/fileops.test.ts:125` (`arjun@rowboatlabs.com`) is a test fixture string.
`apps/harbor` has no `API_URL` importer (lane E owns it — untouched).

## Summary

- Callable Rowboat-backend routes: **15** (#2/#3 share `GET /v1/config`; #4; #5–#7; #8; #9; #10; #11–#13; #15; #17; #18; #19-apex) + the `API_URL` default itself (#1).
- By class: **STUB 4** (#1–#4) · **DELETE 6** (#5, #6, #7, #19, #21, #23) · **REPLACE-WITH-SPINRUN 12** (#8, #9, #10, #11, #12, #13, #14, #15, #16, #18, #25, #26) · **KEEP 7** (#17, #20, #22, #24, #27, #28, #29).
- The three biggest replacements:
  1. **LLM routing** (#8–#10 + `rowboat-selection.ts`, `catalog.ts`, `models.ts` — lane D owns `models/*`): every cloud turn, the provider catalog and the image allowlist ride `{API_URL}/v1/llm*`. **L**.
  2. **Auth session + sign-in** (#25, #26, #4-me, `auth/tokens.ts`, `auth/repo.ts`, `providers.ts`): one Supabase session backs app identity, gateway bearer, connectors and Spaces trust. **L**.
  3. **Google backend-OAuth + picker** (#11–#14): claim/refresh/claim-picked plus the webapp picker dance behind `appUrl`. Email, meetings and Drive attach ride this. **M**.
