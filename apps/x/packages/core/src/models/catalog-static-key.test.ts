import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Managed provider with the static bearer (lane G).
 *
 * With ROWBOAT_MANAGED_LLM=on and SPINRUN_API_KEY=spr_… the catalog lists the
 * managed provider (display name "Spinrun") even when config/models.json has
 * no BYOK provider and no apiKey. Uses the REAL isSignedIn (static key counts
 * as signed in) with a signed-out OAuth repo.
 */

const mocks = vi.hoisted(() => ({
  oauthRead: vi.fn(async (_provider: string) => ({})),
  getConfig: vi.fn(async (): Promise<unknown> => {
    throw new Error('no models.json');
  }),
  getChatGPTStatus: vi.fn(async () => ({ signedIn: false })),
  listGatewayModels: vi.fn(async () => ({
    providers: [{ id: 'rowboat', name: 'Spinrun', models: [{ id: 'google/gemini-2.5-flash-lite' }] }],
  })),
  listCodexModels: vi.fn(async () => ({
    providers: [{ id: 'codex', name: 'OpenAI Codex', models: [{ id: 'gpt-5.6-sol' }] }],
  })),
  listModelsForProvider: vi.fn<(config: unknown) => Promise<string[]>>(async () => ['live-model-1']),
  listGatewayImageModels: vi.fn(async () => ['google/gemini-2.5-flash-image']),
  listImageModelsForProvider: vi.fn<(config: unknown) => Promise<string[]>>(async () => []),
  listOnboardingModels: vi.fn(async () => ({ providers: [] as Array<unknown> })),
  getImageModelIds: vi.fn(async () => [] as string[]),
  getDefaultModelAndProvider: vi.fn(async () => {
    throw new Error('no assistant');
  }),
}));

vi.mock('../auth/chatgpt-auth.js', () => ({ getChatGPTStatus: mocks.getChatGPTStatus }));
vi.mock('./gateway.js', () => ({
  listGatewayModels: mocks.listGatewayModels,
  listGatewayImageModels: mocks.listGatewayImageModels,
}));
vi.mock('./codex.js', () => ({ listCodexModels: mocks.listCodexModels }));
vi.mock('./models.js', () => ({
  listModelsForProvider: mocks.listModelsForProvider,
  listImageModelsForProvider: mocks.listImageModelsForProvider,
}));
vi.mock('./models-dev.js', () => ({
  listOnboardingModels: mocks.listOnboardingModels,
  getImageModelIds: mocks.getImageModelIds,
}));
vi.mock('./defaults.js', () => ({ getDefaultModelAndProvider: mocks.getDefaultModelAndProvider }));
vi.mock('../di/container.js', () => ({
  default: {
    resolve: (name: string) => {
      if (name === 'oauthRepo') return { read: mocks.oauthRead };
      if (name === 'modelConfigRepo') return { getConfig: mocks.getConfig };
      throw new Error(`unexpected resolve(${name})`);
    },
  },
}));

import { getModelCatalog, __resetModelCatalogForTests, providerDisplayName } from './catalog.js';

let savedManaged: string | undefined;
let hadManaged: boolean;
let savedStatic: string | undefined;
let hadStatic: boolean;

beforeEach(() => {
  hadManaged = Object.prototype.hasOwnProperty.call(process.env, 'ROWBOAT_MANAGED_LLM');
  savedManaged = process.env.ROWBOAT_MANAGED_LLM;
  hadStatic = Object.prototype.hasOwnProperty.call(process.env, 'SPINRUN_API_KEY');
  savedStatic = process.env.SPINRUN_API_KEY;
  vi.clearAllMocks();
  __resetModelCatalogForTests();
  mocks.oauthRead.mockResolvedValue({});
  mocks.getChatGPTStatus.mockResolvedValue({ signedIn: false });
  mocks.getConfig.mockRejectedValue(new Error('no models.json'));
  mocks.getDefaultModelAndProvider.mockRejectedValue(new Error('no assistant'));
});

afterEach(() => {
  if (hadManaged) process.env.ROWBOAT_MANAGED_LLM = savedManaged as string;
  else delete process.env.ROWBOAT_MANAGED_LLM;
  if (hadStatic) process.env.SPINRUN_API_KEY = savedStatic as string;
  else delete process.env.SPINRUN_API_KEY;
});

function serveEmptyProviders() {
  mocks.getConfig.mockResolvedValue({ version: 2, providers: {} });
}

describe('managed provider with static key (ROWBOAT_MANAGED_LLM=on + SPINRUN_API_KEY)', () => {
  it('lists the managed provider with display name Spinrun and no BYOK provider', async () => {
    process.env.ROWBOAT_MANAGED_LLM = 'on';
    process.env.SPINRUN_API_KEY = 'spr_static-test-key';
    serveEmptyProviders();

    const catalog = await getModelCatalog();
    expect(catalog.providers.map((p) => p.id)).toEqual(['rowboat']);
    expect(providerDisplayName('rowboat')).toBe('Spinrun');
    expect(mocks.listGatewayModels).toHaveBeenCalledTimes(1);
    // No BYOK provider or apiKey was needed: the providers map is empty.
    expect(mocks.listModelsForProvider).not.toHaveBeenCalled();
  });

  it('does not list the managed provider when the switch is off, even with a static key', async () => {
    process.env.ROWBOAT_MANAGED_LLM = 'off';
    process.env.SPINRUN_API_KEY = 'spr_static-test-key';
    serveEmptyProviders();

    const catalog = await getModelCatalog();
    expect(catalog.providers.map((p) => p.id)).toEqual([]);
    expect(mocks.listGatewayModels).not.toHaveBeenCalled();
  });

  it('does not list the managed provider when signed out with no static key', async () => {
    process.env.ROWBOAT_MANAGED_LLM = 'on';
    delete process.env.SPINRUN_API_KEY;
    serveEmptyProviders();

    const catalog = await getModelCatalog();
    expect(catalog.providers.map((p) => p.id)).toEqual([]);
    expect(mocks.listGatewayModels).not.toHaveBeenCalled();
  });

  it('a wrong-prefix key does not count as signed in', async () => {
    process.env.ROWBOAT_MANAGED_LLM = 'on';
    process.env.SPINRUN_API_KEY = 'gw_wrong-prefix';
    serveEmptyProviders();

    const catalog = await getModelCatalog();
    expect(catalog.providers.map((p) => p.id)).toEqual([]);
  });
});
