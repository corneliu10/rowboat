// Stub contract test (lanes A + G). Starts the stub on a random port and asserts
// both shapes are the client's:
//
// - GET /v1/config parses with the client's own zod schema, RowboatApiConfig
//   (imported from the built packages/shared dist — not copied).
// - GET /v1/me returns the wire shape billing.ts:15-42 reads. The client has
//   NO zod schema for this wire shape (billing.ts casts manually), so the
//   assertions below mirror those exact field reads — manually copied from
//   apps/x/packages/core/src/billing/billing.ts, and said so here.
// - Lane G gateway: POST /v1/llm/chat/completions (whitelist, headers, SSE
//   pass-through, usage log, abort, forced statuses), GET /v1/llm/models
//   (mapping + image empty), POST /v1/llm/images (501). All gateway tests run
//   against a fake upstream server started in this file — no live call.
//
// Run from the repo root:  node --test tools/control-plane-stub/stub.test.mjs

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startStub, buildUpstreamChatBody } from './server.mjs';
import { RowboatApiConfig } from '../../apps/x/packages/shared/dist/rowboat-account.js';

let server;
let base;

// --- fake upstream ---------------------------------------------------------

let upstream;
let upstreamBase;
let upstreamCalls;
let chatHandler;
let modelsPayload;
let modelsCalls;

const SSE_USAGE = [
  'data: {"id":"gen_test123","object":"chat.completion.chunk","created":1,"model":"google/gemini-2.5-flash-lite","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
  '',
  'data: {"id":"gen_test123","object":"chat.completion.chunk","created":1,"model":"google/gemini-2.5-flash-lite","choices":[{"index":0,"delta":{"content":"PONG"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":13,"total_tokens":16}}',
  '',
  'data: [DONE]',
  '',
  '',
].join('\n');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function startUpstream() {
  upstreamCalls = [];
  modelsCalls = 0;
  modelsPayload = { data: [] };
  chatHandler = null;
  upstream = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/chat/completions') {
      const bodyText = await readBody(req);
      let parsed = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = null;
      }
      const record = {
        method: req.method,
        path: url.pathname,
        headers: { ...req.headers },
        bodyText,
        body: parsed,
        aborted: false,
      };
      upstreamCalls.push(record);
      req.on('close', () => {
        if (!res.writableEnded) record.aborted = true;
      });
      if (chatHandler) {
        await chatHandler(req, res, record);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(SSE_USAGE);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/models') {
      modelsCalls += 1;
      upstreamCalls.push({
        method: req.method,
        path: url.pathname,
        headers: { ...req.headers },
        bodyText: '',
        body: null,
        aborted: false,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(modelsPayload));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream no route' }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const address = upstream.address();
  assert.equal(typeof address, 'object');
  upstreamBase = `http://127.0.0.1:${address.port}`;
}

// --- log capture -----------------------------------------------------------

let logLines;
const origLog = console.log;

function clearLogs() {
  logLines = [];
}

function stubLogsFor(method, path) {
  return logLines.filter((line) => line.startsWith(`${method} ${path} ->`));
}

// --- lifecycle -------------------------------------------------------------

let savedUpstream;
let savedGatewayKey;
let savedForce;

before(async () => {
  savedUpstream = process.env.STUB_LLM_UPSTREAM;
  savedGatewayKey = process.env.AI_GATEWAY_API_KEY;
  savedForce = process.env.STUB_LLM_FORCE;
  process.env.AI_GATEWAY_API_KEY = 'gw_test-platform-key';
  await startUpstream();
  process.env.STUB_LLM_UPSTREAM = upstreamBase;
  delete process.env.STUB_LLM_FORCE;
  console.log = (...args) => {
    logLines.push(args.join(' '));
  };
  clearLogs();
  server = await startStub(0);
  const address = server.address();
  assert.equal(typeof address, 'object');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => {
  console.log = origLog;
  server.close();
  upstream.close();
  if (savedUpstream === undefined) delete process.env.STUB_LLM_UPSTREAM;
  else process.env.STUB_LLM_UPSTREAM = savedUpstream;
  if (savedGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = savedGatewayKey;
  if (savedForce === undefined) delete process.env.STUB_LLM_FORCE;
  else process.env.STUB_LLM_FORCE = savedForce;
});

beforeEach(() => {
  clearLogs();
  upstreamCalls.length = 0;
  modelsCalls = 0;
  chatHandler = null;
  delete process.env.STUB_LLM_FORCE;
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
    const res = await fetch(`${base}/v1/nope`);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('content-type'), 'application/json');
    const body = await res.json();
    assert.equal(body.error.code, 'not_found');
  });

  it('llm routes require an spr_ bearer (401 otherwise)', async () => {
    for (const [method, path, init] of [
      ['POST', '/v1/llm/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'm', messages: [] }) }],
      ['GET', '/v1/llm/models', {}],
      ['POST', '/v1/llm/images', { method: 'POST' }],
    ]) {
      const noAuth = await fetch(`${base}${path}`, init);
      assert.equal(noAuth.status, 401, `${method} ${path} without bearer`);
      const wrong = await fetch(`${base}${path}`, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: 'Bearer gw_wrong' },
      });
      assert.equal(wrong.status, 401, `${method} ${path} with wrong prefix`);
    }
    assert.equal(upstreamCalls.length, 0, 'no upstream call on auth failure');
  });

  it('chat/completions applies the body whitelist (drops n/models/providerOptions/user, reduces reasoning, caps max_tokens)', async () => {
    const clientBody = {
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'f' } }],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      temperature: 0.2,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: ['STOP'],
      seed: 7,
      response_format: { type: 'text' },
      stream: true,
      reasoning: { effort: 'low', max_tokens: 9999, extra: 'drop-me' },
      n: 3,
      models: ['should-drop'],
      provider: { order: 'drop' },
      providerOptions: { openrouter: { reasoning: { effort: 'low' } } },
      user: 'drop-me',
      max_tokens: 100000,
    };
    const res = await fetch(`${base}/v1/llm/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer spr_test-bearer',
        'x-rowboat-use-case': 'should-be-dropped',
        'x-rowboat-agent-name': 'should-be-dropped',
      },
      body: JSON.stringify(clientBody),
    });
    assert.equal(res.status, 200);
    await res.text();
    assert.equal(upstreamCalls.length, 1);
    const seen = upstreamCalls[0].body;
    // Whitelist kept:
    for (const key of [
      'model',
      'messages',
      'tools',
      'tool_choice',
      'parallel_tool_calls',
      'temperature',
      'top_p',
      'frequency_penalty',
      'presence_penalty',
      'stop',
      'seed',
      'response_format',
      'stream',
    ]) {
      assert.ok(key in seen, `keeps ${key}`);
    }
    // Reasoning reduced to effort/enabled/exclude:
    assert.deepEqual(seen.reasoning, { effort: 'low' });
    // max_tokens capped:
    assert.equal(seen.max_tokens, 8192);
    // stream_options forced:
    assert.deepEqual(seen.stream_options, { include_usage: true });
    // Dropped:
    for (const key of ['n', 'models', 'provider', 'providerOptions', 'user']) {
      assert.ok(!(key in seen), `drops ${key}`);
    }
  });

  it('chat/completions drops incoming auth + x-rowboat-* headers (upstream sees only the platform key)', async () => {
    const res = await fetch(`${base}/v1/llm/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer spr_client-key-should-not-forward',
        'x-rowboat-use-case': 'chat',
        'x-rowboat-sub-use-case': 'test',
        'x-rowboat-agent-name': 'copilot',
      },
      body: JSON.stringify({ model: 'm', messages: [], stream: false }),
    });
    assert.equal(res.status, 200);
    await res.text();
    assert.equal(upstreamCalls.length, 1);
    const headers = upstreamCalls[0].headers;
    assert.equal(headers.authorization, 'Bearer gw_test-platform-key');
    assert.ok(!Object.keys(headers).some((k) => k.startsWith('x-rowboat-')), 'no x-rowboat-* upstream');
    assert.ok(!String(headers.authorization || '').includes('spr_'), 'client bearer never forwarded');
  });

  it('chat/completions pipes SSE bytes byte-for-byte and logs usage (never a body, never a key)', async () => {
    const res = await fetch(`${base}/v1/llm/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer spr_test' },
      body: JSON.stringify({ model: 'm', messages: [], stream: true }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, SSE_USAGE, 'SSE bytes identical');
    const lines = stubLogsFor('POST', '/v1/llm/chat/completions');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /POST \/v1\/llm\/chat\/completions -> 200/);
    assert.match(lines[0], /upstream=\d+ms/);
    assert.match(lines[0], /prompt=3 completion=13 total=16/);
    assert.ok(!lines[0].includes('spr_'), 'log never carries a key');
    assert.ok(!lines[0].includes('PONG') && !lines[0].includes('messages'), 'log never carries a body');
  });

  it('chat/completions aborts upstream when the client disconnects', async () => {
    // Fake upstream delays its headers so the client abort lands while the
    // stub is still awaiting upstream. The stub must abort its upstream fetch.
    // Detect via the upstream RESPONSE close (the request stream already ended
    // after readBody, so its close already fired normally).
    let upstreamAborted = false;
    chatHandler = async (_upstreamReq, upstreamRes, record) => {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        upstreamRes.on('close', () => {
          if (!upstreamRes.writableEnded) {
            upstreamAborted = true;
            record.aborted = true;
            clearTimeout(timer);
            resolve();
          }
        });
      });
      try {
        if (!upstreamRes.writableEnded) {
          upstreamRes.writeHead(200, { 'Content-Type': 'text/event-stream' });
          upstreamRes.end(SSE_USAGE);
        }
      } catch {}
    };
    const controller = new AbortController();
    const pending = fetch(`${base}/v1/llm/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer spr_abort-test' },
      body: JSON.stringify({ model: 'm', messages: [], stream: true }),
      signal: controller.signal,
    });
    // Abort while the stub is still waiting on upstream headers.
    await new Promise((r) => setTimeout(r, 150));
    controller.abort();
    await assert.rejects(pending);
    // Give the stub a moment to propagate the abort upstream.
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(upstreamAborted || upstreamCalls[0]?.aborted, 'upstream saw the abort');
  });

  it('GET /v1/llm/models maps upstream /models to {data:[{id}]} (language only)', async () => {
    modelsPayload = {
      data: [
        { id: 'google/gemini-2.5-flash-lite', architecture: { output_modalities: ['text'] } },
        { id: 'img/only-model', architecture: { output_modalities: ['image'] } },
        { id: 'both/modal', architecture: { output_modalities: ['text', 'image'] } },
        { id: 'no-arch-model' },
        { name: 'missing-id' },
        null,
      ],
    };
    const res = await fetch(`${base}/v1/llm/models`, {
      headers: { Authorization: 'Bearer spr_test' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, {
      data: [{ id: 'google/gemini-2.5-flash-lite' }, { id: 'both/modal' }, { id: 'no-arch-model' }],
    });
    assert.equal(modelsCalls, 1);
  });

  it('GET /v1/llm/models?output_modalities=image answers {data:[]} without upstream', async () => {
    const res = await fetch(`${base}/v1/llm/models?output_modalities=image`, {
      headers: { Authorization: 'Bearer spr_test' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: [] });
    assert.equal(modelsCalls, 0);
  });

  it('POST /v1/llm/images is 501 not_implemented', async () => {
    const res = await fetch(`${base}/v1/llm/images`, {
      method: 'POST',
      headers: { Authorization: 'Bearer spr_test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'a cat' }),
    });
    assert.equal(res.status, 501);
    const body = await res.json();
    assert.equal(body.error.code, 'not_implemented');
    assert.equal(body.error.type, 'invalid_request_error');
    assert.equal(typeof body.error.message, 'string');
  });

  it('STUB_LLM_FORCE makes chat/completions answer 401|402|429 with an OpenAI-style error (no upstream)', async () => {
    for (const status of [401, 402, 429]) {
      process.env.STUB_LLM_FORCE = String(status);
      const res = await fetch(`${base}/v1/llm/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer spr_test' },
        body: JSON.stringify({ model: 'm', messages: [] }),
      });
      assert.equal(res.status, status);
      const body = await res.json();
      assert.equal(typeof body.error.message, 'string');
      assert.equal(typeof body.error.type, 'string');
    }
    assert.equal(upstreamCalls.length, 0, 'forced statuses never hit upstream');
    delete process.env.STUB_LLM_FORCE;
  });

  it('buildUpstreamChatBody is the exact whitelist the real endpoint will use', () => {
    const out = buildUpstreamChatBody({
      model: 'm',
      messages: [],
      n: 5,
      models: ['x'],
      provider: 'y',
      providerOptions: { z: 1 },
      user: 'u',
      max_tokens: 99999,
      reasoning: { effort: 'high', enabled: true, exclude: false, junk: 1 },
      stream: true,
    });
    assert.equal(out.max_tokens, 8192);
    assert.deepEqual(out.reasoning, { effort: 'high', enabled: true, exclude: false });
    assert.deepEqual(out.stream_options, { include_usage: true });
    for (const dropped of ['n', 'models', 'provider', 'providerOptions', 'user']) {
      assert.ok(!(dropped in out));
    }
  });
});
