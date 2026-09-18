import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Static Spinrun bearer (lane G spike).
 *
 * - staticSpinrunKey() reads SPINRUN_API_KEY only when it starts with spr_.
 * - getAccessToken() returns it first when present (OAuth never wins).
 * - isSignedIn() is true when present (OAuth intact otherwise).
 */

const mocks = vi.hoisted(() => ({
  oauthRead: vi.fn(async (_provider: string) => ({})),
}));

vi.mock('../di/container.js', () => ({
  default: {
    resolve: (name: string) => {
      if (name === 'oauthRepo') {
        return { read: mocks.oauthRead };
      }
      throw new Error(`unexpected resolve(${name}) in static-key test`);
    },
  },
}));

import { staticSpinrunKey, STATIC_SPINRUN_KEY_ENV_VAR } from './static-key.js';
import { getAccessToken } from './tokens.js';
import { isSignedIn } from '../account/account.js';

function oauthTokens(access_token = 'oauth-access-token') {
  return {
    access_token,
    refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
}

let savedEnv: string | undefined;
let hadEnv: boolean;

beforeEach(() => {
  hadEnv = Object.prototype.hasOwnProperty.call(process.env, STATIC_SPINRUN_KEY_ENV_VAR);
  savedEnv = process.env[STATIC_SPINRUN_KEY_ENV_VAR];
  delete process.env[STATIC_SPINRUN_KEY_ENV_VAR];
  mocks.oauthRead.mockReset();
  mocks.oauthRead.mockResolvedValue({});
});

afterEach(() => {
  if (hadEnv) {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = savedEnv as string;
  } else {
    delete process.env[STATIC_SPINRUN_KEY_ENV_VAR];
  }
});

describe('staticSpinrunKey', () => {
  it('returns the value when it starts with spr_', () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'spr_test123';
    expect(staticSpinrunKey()).toBe('spr_test123');
  });

  it('returns null when unset', () => {
    delete process.env[STATIC_SPINRUN_KEY_ENV_VAR];
    expect(staticSpinrunKey()).toBeNull();
  });

  it('returns null for a wrong prefix', () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'gw_sk123';
    expect(staticSpinrunKey()).toBeNull();
  });

  it('returns null for an empty value', () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = '';
    expect(staticSpinrunKey()).toBeNull();
  });
});

describe('getAccessToken with static key', () => {
  it('returns the static key when set, without touching the OAuth repo', async () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'spr_static-bearer';
    const token = await getAccessToken();
    expect(token).toBe('spr_static-bearer');
    expect(mocks.oauthRead).not.toHaveBeenCalled();
  });

  it('static key wins when OAuth tokens are present alongside', async () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'spr_static-wins';
    mocks.oauthRead.mockResolvedValue({ tokens: oauthTokens('oauth-should-lose') });
    const token = await getAccessToken();
    expect(token).toBe('spr_static-wins');
    expect(mocks.oauthRead).not.toHaveBeenCalled();
  });

  it('falls through to OAuth when no static key is set', async () => {
    delete process.env[STATIC_SPINRUN_KEY_ENV_VAR];
    mocks.oauthRead.mockResolvedValue({ tokens: oauthTokens('oauth-token-ok') });
    await expect(getAccessToken()).resolves.toBe('oauth-token-ok');
    expect(mocks.oauthRead).toHaveBeenCalledWith('rowboat');
  });

  it('falls through to OAuth error when signed out and no static key', async () => {
    delete process.env[STATIC_SPINRUN_KEY_ENV_VAR];
    mocks.oauthRead.mockResolvedValue({});
    await expect(getAccessToken()).rejects.toThrow(/Not signed into Spinrun/);
  });

  it('ignores a wrong-prefix value and uses OAuth instead', async () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'sk_wrong-prefix';
    mocks.oauthRead.mockResolvedValue({ tokens: oauthTokens('oauth-fallback') });
    await expect(getAccessToken()).resolves.toBe('oauth-fallback');
  });
});

describe('isSignedIn with static key', () => {
  it('is true when the static key is set, even with no OAuth session', async () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'spr_static-signed-in';
    mocks.oauthRead.mockResolvedValue({});
    await expect(isSignedIn()).resolves.toBe(true);
    expect(mocks.oauthRead).not.toHaveBeenCalled();
  });

  it('is true when both static key and OAuth tokens are present', async () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'spr_both-present';
    mocks.oauthRead.mockResolvedValue({ tokens: oauthTokens() });
    await expect(isSignedIn()).resolves.toBe(true);
  });

  it('delegates to OAuth when no static key is set (signed in)', async () => {
    delete process.env[STATIC_SPINRUN_KEY_ENV_VAR];
    mocks.oauthRead.mockResolvedValue({ tokens: oauthTokens() });
    await expect(isSignedIn()).resolves.toBe(true);
  });

  it('delegates to OAuth when no static key is set (signed out)', async () => {
    delete process.env[STATIC_SPINRUN_KEY_ENV_VAR];
    mocks.oauthRead.mockResolvedValue({});
    await expect(isSignedIn()).resolves.toBe(false);
  });

  it('a wrong-prefix value does not count as signed in', async () => {
    process.env[STATIC_SPINRUN_KEY_ENV_VAR] = 'gw_not-spinrun';
    mocks.oauthRead.mockResolvedValue({});
    await expect(isSignedIn()).resolves.toBe(false);
  });
});
