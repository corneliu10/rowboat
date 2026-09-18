import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

/**
 * rowboat-selection with the static bearer (lane G).
 *
 * With ROWBOAT_MANAGED_LLM=on and SPINRUN_API_KEY=spr_…,
 * applyRowboatInitialSelection() seeds the assistant model from
 * GET /v1/llm/models (real listGatewayModels, mocked fetch) with no BYOK
 * provider or apiKey in config/models.json. The Authorization bearer the
 * client sends is the static key.
 */

const mocks = vi.hoisted(() => ({
  oauthRead: vi.fn(async (_provider: string) => ({})),
  getConfig: vi.fn(async (): Promise<unknown> => null),
  updateConfig: vi.fn(async (_patch: unknown) => {}),
  getRowboatConfig: vi.fn(async () => null),
  capture: vi.fn(() => {}),
  markSeen: vi.fn(async (_flavor: string) => {}),
}));

vi.mock('../di/container.js', () => ({
  default: {
    resolve: (name: string) => {
      if (name === 'oauthRepo') return { read: mocks.oauthRead };
      if (name === 'modelConfigRepo')
        return { getConfig: mocks.getConfig, updateConfig: mocks.updateConfig };
      throw new Error(`unexpected resolve(${name})`);
    },
  },
}));

vi.mock('../config/rowboat.js', () => ({ getRowboatConfig: mocks.getRowboatConfig }));
vi.mock('../analytics/posthog.js', () => ({ capture: mocks.capture }));
vi.mock('./recommendation-update.js', () => ({ markRecommendationSeen: mocks.markSeen }));

import { applyRowboatInitialSelection } from './rowboat-selection.js';

let savedManaged: string | undefined;
let hadManaged: boolean;
let savedStatic: string | undefined;
let hadStatic: boolean;
let fetchMock: ReturnType<typeof vi.fn>;
let seenAuth: string | null;

const GATEWAY_MODELS = ['google/gemini-2.5-flash-lite', 'openai/gpt-5.4'];

beforeEach(() => {
  hadManaged = Object.prototype.hasOwnProperty.call(process.env, 'ROWBOAT_MANAGED_LLM');
  savedManaged = process.env.ROWBOAT_MANAGED_LLM;
  hadStatic = Object.prototype.hasOwnProperty.call(process.env, 'SPINRUN_API_KEY');
  savedStatic = process.env.SPINRUN_API_KEY;
  vi.clearAllMocks();
  seenAuth = null;
  mocks.oauthRead.mockResolvedValue({});
  mocks.getConfig.mockResolvedValue(null);
  mocks.getRowboatConfig.mockResolvedValue(null);
  fetchMock = vi.fn(async (input: unknown, init?: { headers?: unknown }) => {
    const url = String(input);
    if (url.includes('/v1/llm/models')) {
      const headers = new Headers(init?.headers as HeadersInit);
      seenAuth = headers.get('authorization');
      return Response.json({ data: GATEWAY_MODELS.map((id) => ({ id })) });
    }
    throw new Error(`unexpected fetch(${url})`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  if (hadManaged) process.env.ROWBOAT_MANAGED_LLM = savedManaged as string;
  else delete process.env.ROWBOAT_MANAGED_LLM;
  if (hadStatic) process.env.SPINRUN_API_KEY = savedStatic as string;
  else delete process.env.SPINRUN_API_KEY;
  vi.unstubAllGlobals();
});

describe('applyRowboatInitialSelection with static key', () => {
  it('seeds the assistant from GET /v1/llm/models with the static bearer and no BYOK', async () => {
    process.env.ROWBOAT_MANAGED_LLM = 'on';
    process.env.SPINRUN_API_KEY = 'spr_static-seed-key';

    await applyRowboatInitialSelection();

    // The client really hit GET /v1/llm/models …
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/llm\/models$/);
    // … with the static key as the bearer …
    expect(seenAuth).toBe('Bearer spr_static-seed-key');
    // … and saved the first listed model as the rowboat assistant.
    expect(mocks.updateConfig).toHaveBeenCalledTimes(2);
    const assistantPatch = mocks.updateConfig.mock.calls[0][0] as {
      assistantModel?: { provider: string; model: string };
    };
    expect(assistantPatch.assistantModel).toMatchObject({
      provider: 'rowboat',
      model: 'google/gemini-2.5-flash-lite',
    });
    // No BYOK provider was consulted: the config had none and no apiKey exists.
    expect(mocks.getConfig).toHaveBeenCalled();
  });

  it('does nothing when the switch is off, even with a static key', async () => {
    process.env.ROWBOAT_MANAGED_LLM = 'off';
    process.env.SPINRUN_API_KEY = 'spr_static-off';

    await applyRowboatInitialSelection();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  it('keeps a saved assistant choice (never replaced silently)', async () => {
    process.env.ROWBOAT_MANAGED_LLM = 'on';
    process.env.SPINRUN_API_KEY = 'spr_static-keep';
    mocks.getConfig.mockResolvedValue({
      version: 2,
      providers: {},
      assistantModel: { provider: 'rowboat', model: 'openai/gpt-5.4' },
      imageModel: { provider: 'rowboat', model: 'google/gemini-2.5-flash-image' },
    });

    await applyRowboatInitialSelection();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });
});
