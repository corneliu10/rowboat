import { describe, expect, it } from 'vitest';
import { brand, CODE_SESSION_BRANCH_PREFIX } from './brand.js';
import { DEEP_LINK_SCHEME, MENTION_HANDLE } from '@rowboat/spaces-protocol';

describe('brand / protocol drift guard', () => {
  it('mentionHandle matches the protocol MENTION_HANDLE', () => {
    expect(brand.mentionHandle).toBe(MENTION_HANDLE);
    expect(MENTION_HANDLE).toBe('spinball');
  });

  it('deepLinkScheme matches the protocol DEEP_LINK_SCHEME', () => {
    expect(brand.deepLinkScheme).toBe(DEEP_LINK_SCHEME);
    expect(DEEP_LINK_SCHEME).toBe('spinrun');
  });

  it('carries the eleven rebrand values', () => {
    expect(brand.productName).toBe('Spinrun');
    expect(brand.assistantName).toBe('Spinball');
    expect(brand.companyName).toBe('Spinrun');
    expect(brand.siteUrl).toBe('https://spinrun.ai');
    expect(brand.docsUrl).toBe('https://spinrun.ai/docs');
    expect(brand.supportUrl).toBe('https://spinrun.ai/support');
  });

  it('branch prefix follows the executable name', () => {
    expect(CODE_SESSION_BRANCH_PREFIX).toBe('spinrun/');
    expect(CODE_SESSION_BRANCH_PREFIX).toBe(`${brand.executableName}/`);
  });
});
