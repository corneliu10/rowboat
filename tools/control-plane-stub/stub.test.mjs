// Stub contract test (lane A). Starts the stub on a random port and asserts
// both shapes are the client's:
//
// - GET /v1/config parses with the client's own zod schema, RowboatApiConfig
//   (imported from the built packages/shared dist — not copied).
// - GET /v1/me returns the wire shape billing.ts:15-42 reads. The client has
//   NO zod schema for this wire shape (billing.ts casts manually), so the
//   assertions below mirror those exact field reads — manually copied from
//   apps/x/packages/core/src/billing/billing.ts, and said so here.
// - anything else is 404 JSON.
//
// Run from the repo root:  node --test tools/control-plane-stub/stub.test.mjs

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStub } from './server.mjs';
import { RowboatApiConfig } from '../../apps/x/packages/shared/dist/rowboat-account.js';

let server;
let base;

before(async () => {
  server = await startStub(0);
  const address = server.address();
  assert.equal(typeof address, 'object');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
});

describe('control-plane stub', () => {
  it('GET /v1/config parses with the client RowboatApiConfig schema', async () => {
    const res = await fetch(`${base}/v1/config`);
    assert.equal(res.status, 200);
    const parsed = RowboatApiConfig.parse(await res.json());
    const address = server.address();
    assert.equal(parsed.appUrl, `http://127.0.0.1:${address.port}`);
    assert.equal(parsed.supabaseUrl, '');
    assert.equal(parsed.websocketApiUrl, '');
    assert.equal(parsed.spacesApexUrl, null);
    assert.ok(Array.isArray(parsed.billing.plans) && parsed.billing.plans.length >= 1);
  });

  it('GET /v1/me returns the shape billing.ts parses, with inexhaustible credits', async () => {
    const res = await fetch(`${base}/v1/me`);
    assert.equal(res.status, 200);
    const body = await res.json();
    // Field reads mirrored from billing.ts:15-42:
    assert.equal(typeof body.user.id, 'string');
    assert.equal(typeof body.user.email, 'string');
    assert.equal(typeof body.billing.planId, 'string');
    assert.equal(typeof body.billing.status, 'string');
    assert.ok(body.billing.trialExpiresAt === null || typeof body.billing.trialExpiresAt === 'string');
    for (const bucket of [body.billing.usage.monthly, body.billing.usage.daily]) {
      assert.equal(typeof bucket.sanctionedCredits, 'number');
      assert.equal(typeof bucket.usedCredits, 'number');
      assert.equal(typeof bucket.availableCredits, 'number');
      assert.ok(bucket.availableCredits > bucket.usedCredits, 'plan must never run out of credits');
    }
    assert.equal(typeof body.billing.usage.daily.usageDay, 'string');
    assert.equal(typeof body.billing.usage.store.availableCredits, 'number');
  });

  it('unknown paths are 404 JSON', async () => {
    const res = await fetch(`${base}/v1/llm/models`, { headers: { Authorization: 'Bearer x' } });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('content-type'), 'application/json');
    const body = await res.json();
    assert.equal(body.error.code, 'not_found');
  });
});
