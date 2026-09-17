# 04 — LLM providers (BYOK, managed switch, AI Gateway)

Fork lane `spike/d-llm-byok` on top of `spike/base`.
Default in this fork: managed Rowboat provider **off**.
Switch: `MANAGED_LLM_ENABLED()` in `apps/x/packages/core/src/models/managed.ts:18`,
reading `ROWBOAT_MANAGED_LLM` (`MANAGED_LLM_ENV_VAR` at `managed.ts:12`), default `"off"`.

## Where provider keys are stored on disk

All paths resolve under `WorkDir` (`apps/x/packages/core/src/config/config.ts:5-21`:
`process.env.ROWBOAT_WORKDIR` or `path.join(homedir(), ".rowboat")`).

- BYOK keys: `path.join(WorkDir, "config", "models.json")`
  (`apps/x/packages/core/src/models/repo.ts:56`).
  Plaintext JSON (`LlmModelConfig`, `apps/x/packages/shared/src/models.ts:88-109`).
  Writes are atomic temp+rename (`repo.ts:202-204`); corrupt files are
  quarantined, never overwritten (`repo.ts:81-84`); schema-invalid files make
  writes fail rather than clobber keys (`repo.test.ts` data-safety suite).
  No keychain, no encryption — contrast ChatGPT below.
- Rowboat sign-in session: `path.join(WorkDir, 'config', 'oauth.json')`
  (`apps/x/packages/core/src/auth/repo.ts:79`), record `"rowboat"`
  (`isSignedIn()` in `apps/x/packages/core/src/account/account.ts:6-9`
  via `isAppSignIn`).
- ChatGPT subscription: `path.join(WorkDir, 'config', 'chatgpt-auth.json')`
  (`apps/x/packages/core/src/auth/chatgpt-auth.ts:23`).
  Encrypted when Electron wires a `TokenCipher` (safeStorage/OS keychain,
  `chatgpt-auth.ts:25-37`, file mode `0o600` at `:130`); otherwise plaintext
  fallback with marker (`tokens` / `plaintext`, `:52-56`).

Secrets are read from the environment only and never written into tracked
files, commits, docs, or committed logs.

## Which files decide provider selection

- Discovery/listing: `apps/x/packages/core/src/models/catalog.ts`
  (`discoverProviders()`, `getModelCatalog()`, `getImageModelCatalog()`).
  Rowboat comes from `isSignedIn()` auth state; everything else from the
  `models.json` providers map. Served to the renderer through `models:list`
  (`apps/x/apps/server/src/core-deps.ts:228`).
- Default + resolution: `apps/x/packages/core/src/models/defaults.ts`
  (`getDefaultModelAndProvider()`, `resolveProviderConfig()`).
  No hidden defaults — the config's `assistantModel` is the source of truth.
- Initial pick (first connect): `@x/shared` pure logic
  (`apps/x/packages/shared/src/initial-selection.ts`: `selectInitialModel`,
  `selectInitialTaskModels`), wrapped in core
  (`apps/x/packages/core/src/models/initial-selection.ts`) so the managed
  switch can block the rowboat auto-select.
- Sign-in seeding: `apps/x/packages/core/src/models/rowboat-selection.ts`
  (`applyRowboatInitialSelection()`, `seedAssistantModel()`,
  `seedImageModel()`, `clearRowboatSelections()`, `ROWBOAT_IMAGE_MODEL`);
  ChatGPT mirror: `chatgpt-selection.ts`.
- Storage/migration: `repo.ts`, `migrate.ts`, `recommendation-update.ts`.
- Model construction/listing: `models.ts` (`createProvider()`,
  `createLanguageModel()`, `listModelsForProvider()`),
  `gateway.ts` (`getGatewayProvider()`, `listGatewayModels()`,
  `listGatewayImageModels()`, `authedFetch`), `codex.ts`, `models-dev.ts`.
- Renderer: `apps/x/apps/renderer/src/components/settings/providers-section.tsx`
  (`BYOK_CATALOG`, `DEFAULT_BASE_URLS`, `AddProviderDialog connect()`),
  `model-selection-section.tsx`, `hooks/use-models.ts` (`buildSnapshot()`,
  `isRowboatConnected`), `components/onboarding/steps/llm-setup-step.tsx`,
  `components/model-selector.tsx`; server config passthrough
  `models:getConfig` (`core-deps.ts:238-262`).

## The switch added

- `apps/x/packages/core/src/models/managed.ts:12,18`:
  `MANAGED_LLM_ENV_VAR = "ROWBOAT_MANAGED_LLM"`,
  `MANAGED_LLM_ENABLED = (): boolean => ...` (`"on"/"1"/"true"` → on,
  else off; unset → `"off"`). `gateway.ts` is **not** deleted.
- `catalog.ts:4,132`: `if (MANAGED_LLM_ENABLED() && (await isSignedIn()...))`
  — when off, the rowboat provider is not listed (chat or image catalogs).
- `rowboat-selection.ts:6,38`: `if (!MANAGED_LLM_ENABLED()) return;` — when
  off, sign-in never auto-selects rowboat.
- `initial-selection.ts:10,16,24`: when off, `selectInitialModel("rowboat",…)`
  → `null` and `selectInitialTaskModels("rowboat",…)` → `{}` — fallback is
  the first configured BYOK provider (BYOK connect flow picks its first
  listed model) or `"none"` (null assistant) with the settings prompt
  (`llm-setup-step.tsx:26-31`, provider empty-state).
- Renderer one-guard hunk (`providers-section.tsx:303-306`): local
  `const managedLlmEnabled = false` gates the Rowboat sign-in entry so the
  Add-provider list renders no managed entry while the switch defaults off.
- Tests (both values): `catalog.test.ts` (`MANAGED_LLM_ENABLED …` block:
  env parsing, catalog on/off, image-catalog off) and
  `initial-selection.test.ts` (`MANAGED_LLM_ENABLED switch …` block:
  rowboat pick on/off, task-override off, BYOK fallback off).
  Targeted: `catalog.test.ts` + `initial-selection.test.ts` 30/30 pass;
  `catalog` + `initial-selection` + `gateway` + `repo` 40/40 pass.

## What a Spinrun-routed provider would need to touch

AI Gateway already exists as a BYOK flavor, not as Spinrun-credited auth:

- Flavor plumbing: `LlmProvider` enum (`shared/src/models.ts:19` includes
  `"aigateway"`), `catalog.ts:64,85,152-153`
  (`AIGATEWAY_DEFAULT_BASE_URL = "https://ai-gateway.vercel.sh/v1"`,
  keyed-but-URL-less defaulting), `models.ts:35-40,284-287`
  (`createGateway()` / `/models` listing), renderer `BYOK_CATALOG`
  (`providers-section.tsx:62`) + `DEFAULT_BASE_URLS` (`:69`).
- A Spinrun-routed provider (AI Gateway via Spinrun's credits, no user key)
  would need, beyond reusing that flavor: a credential-less auth source
  (like `oauth.json`/`chatgpt-auth.json`, not `models.json` plaintext);
  catalog discovery from that auth state (like `isSignedIn()` for rowboat);
  a construction path that injects Spinrun's key server-side (never ship the
  key to the desktop — cf. `authedFetch` bearer pattern in `gateway.ts:10-19`
  and `getGatewayProvider()` at `:21-27`); billing/credits metering
  (`packages/core/src/billing/`, untouched in this lane); the settings hide/
  show rule (the one-hunk pattern above, wired to a real flag instead of
  `false`); and recommendation/update + image-listing entries if Spinrun
  serves those modalities.
